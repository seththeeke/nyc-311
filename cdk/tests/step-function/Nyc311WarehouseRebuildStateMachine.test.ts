import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { describe, expect, it } from "vitest";
import { OrdersTable } from "../../data/OrdersTable";
import { RequestsTable } from "../../data/RequestsTable";
import { LocationsTable } from "../../data/LocationsTable";
import { Nyc311WarehouseBucket } from "../../warehouse/Nyc311WarehouseBucket";
import { Nyc311WarehouseRebuildStateMachine } from "../../step-function/Nyc311WarehouseRebuildStateMachine";

function synth(envName: "TEST" | "PROD" = "TEST"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const fn = (id: string) =>
    new lambda.Function(stack, id, {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromInline("exports.handler = async () => {};"),
    });
  new Nyc311WarehouseRebuildStateMachine(stack, "Nyc311WarehouseRebuildStateMachine", {
    envName,
    warehouseBucket: new Nyc311WarehouseBucket(stack, "Nyc311WarehouseBucket", { envName }),
    ordersTable: new OrdersTable(stack, "OrdersTable", { envName }),
    requestsTable: new RequestsTable(stack, "RequestsTable", { envName }),
    locationsTable: new LocationsTable(stack, "LocationsTable", { envName }),
    rebuildLambda: fn("RebuildLambda"),
    jobRunnerLambda: fn("JobRunnerLambda"),
  });
  return Template.fromStack(stack);
}

describe("Nyc311WarehouseRebuildStateMachine", () => {
  it("names the state machine per environment", () => {
    synth("TEST").hasResourceProperties("AWS::StepFunctions::StateMachine", {
      StateMachineName: "Nyc311WarehouseRebuild-Test",
    });
    synth("PROD").hasResourceProperties("AWS::StepFunctions::StateMachine", {
      StateMachineName: "Nyc311WarehouseRebuild-Prod",
    });
  });

  it("defines a per-source export → poll → rebuild flow for all three sources, then RecomputeJobs", () => {
    const definition = JSON.stringify(synth("TEST").toJSON());
    for (const source of ["orders", "requests", "locations"]) {
      expect(definition).toContain(`StartExport-${source}`);
      expect(definition).toContain(`DescribeExport-${source}`);
      expect(definition).toContain(`Rebuild-${source}`);
      expect(definition).toContain(`export-staging/${source}/`);
    }
    expect(definition).toContain("RecomputeJobs");
    expect(definition).toContain("exportTableToPointInTime");
    expect(definition).toContain("$$.Execution.StartTime");
  });

  it("grants ExportTableToPointInTime + DescribeExport on the source tables and S3 write on export-staging", () => {
    const json = JSON.stringify(synth("TEST").toJSON());
    expect(json).toContain("dynamodb:ExportTableToPointInTime");
    expect(json).toContain("dynamodb:DescribeExport");
    expect(json).toContain("s3:PutObject");
    expect(json).toContain("s3:AbortMultipartUpload");
    expect(json).toContain("export-staging/*");
  });

  it("logs at ALL level to a DESTROY-policy vended log group", () => {
    const template = synth("TEST");
    template.hasResourceProperties("AWS::StepFunctions::StateMachine", {
      LoggingConfiguration: Match.objectLike({ Level: "ALL" }),
    });
    template.hasResource("AWS::Logs::LogGroup", {
      DeletionPolicy: "Delete",
      Properties: { LogGroupName: "/aws/vendedlogs/states/Nyc311WarehouseRebuild-Test" },
    });
  });
});
