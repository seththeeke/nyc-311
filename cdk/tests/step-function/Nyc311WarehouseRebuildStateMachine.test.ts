import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { describe, expect, it } from "vitest";
import { OrdersTable } from "../../data/OrdersTable";
import { RequestsTable } from "../../data/RequestsTable";
import { LocationsTable } from "../../data/LocationsTable";
import { Nyc311WarehouseBucket } from "../../warehouse/Nyc311WarehouseBucket";
import { Nyc311WarehouseRebuildStateMachine } from "../../step-function/Nyc311WarehouseRebuildStateMachine";

function synth(envName: "TEST" | "PROD" = "TEST"): { template: Template; definition: string } {
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
  const template = Template.fromStack(stack);
  const sm = Object.values(template.findResources("AWS::StepFunctions::StateMachine"))[0] as {
    Properties: { DefinitionString: { "Fn::Join": [string, unknown[]] } };
  };
  /* DefinitionString is an Fn::Join of literals + token refs — flatten to text for substring assertions. */
  const definition = sm.Properties.DefinitionString["Fn::Join"][1]
    .map((part) => (typeof part === "string" ? part : "<TOKEN>"))
    .join("");
  return { template, definition };
}

describe("Nyc311WarehouseRebuildStateMachine", () => {
  it("names the state machine per environment", () => {
    synth("TEST").template.hasResourceProperties("AWS::StepFunctions::StateMachine", {
      StateMachineName: "Nyc311WarehouseRebuild-Test",
    });
    synth("PROD").template.hasResourceProperties("AWS::StepFunctions::StateMachine", {
      StateMachineName: "Nyc311WarehouseRebuild-Prod",
    });
  });

  it("runs export → poll → wipe → paced replay Map → finalize per source, then RecomputeJobs", () => {
    const { definition } = synth("TEST");
    for (const source of ["orders", "requests", "locations"]) {
      for (const state of [
        `StartExport-${source}`,
        `DescribeExport-${source}`,
        `Wipe-${source}`,
        `ReplayChunks-${source}`,
        `PaceChunk-${source}`,
        `ReplayChunk-${source}`,
        `Finalize-${source}`,
        `MarkFailed-${source}`,
      ]) {
        expect(definition).toContain(state);
      }
      expect(definition).toContain(`export-staging/${source}/`);
      expect(definition).toContain(`"phase":"wipe","source":"${source}"`);
    }
    expect(definition).toContain("RecomputeJobs");
    expect(definition).toContain("exportTableToPointInTime");
    expect(definition).toContain("$$.Execution.StartTime");
  });

  it("replays serially (maxConcurrency 1), pacing each chunk with a Wait, item captured via ItemSelector", () => {
    const { definition } = synth("TEST");
    expect(definition).toContain('"MaxConcurrency":1');
    expect(definition).toContain('"Type":"Wait","Seconds":3');
    expect(definition).toContain('"Next":"MarkFailed-orders"');
    /* $$.Map.Item.Value is captured at the Map boundary, not referenced deep in the nested Wait→Task. */
    expect(definition).toContain('"ItemSelector":{"chunk.$":"$$.Map.Item.Value"');
    expect(definition).toContain('"chunk.$":"$.chunk"');
  });

  it("grants ExportTableToPointInTime + DescribeExport on the source tables and S3 write on export-staging", () => {
    const iam = JSON.stringify(synth("TEST").template.findResources("AWS::IAM::Policy"));
    expect(iam).toContain("dynamodb:ExportTableToPointInTime");
    expect(iam).toContain("dynamodb:DescribeExport");
    expect(iam).toContain("s3:PutObject");
    expect(iam).toContain("s3:AbortMultipartUpload");
    expect(iam).toContain("export-staging/*");
  });

  it("logs at ALL level to a DESTROY-policy vended log group, timeout 6h", () => {
    const { template, definition } = synth("TEST");
    template.hasResourceProperties("AWS::StepFunctions::StateMachine", {
      LoggingConfiguration: Match.objectLike({ Level: "ALL" }),
    });
    template.hasResource("AWS::Logs::LogGroup", {
      DeletionPolicy: "Delete",
      Properties: { LogGroupName: "/aws/vendedlogs/states/Nyc311WarehouseRebuild-Test" },
    });
    expect(definition).toContain('"TimeoutSeconds":21600');
  });
});
