import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import * as sns from "aws-cdk-lib/aws-sns";
import { describe, expect, it } from "vitest";
import { WarehouseJobRunsTable } from "../../data/WarehouseJobRunsTable";
import { Nyc311WarehouseBucket } from "../../warehouse/Nyc311WarehouseBucket";
import { Nyc311WarehouseCatalog } from "../../warehouse/Nyc311WarehouseCatalog";
import { Nyc311WarehouseTransformLambda } from "../../warehouse/Nyc311WarehouseTransformLambda";
import { Nyc311WarehouseFirehose } from "../../warehouse/Nyc311WarehouseFirehose";
import { Nyc311WarehouseRebuildLambda } from "../../warehouse/Nyc311WarehouseRebuildLambda";

function synth(envName: "TEST" | "PROD" = "TEST"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const warehouseBucket = new Nyc311WarehouseBucket(stack, "Nyc311WarehouseBucket", { envName });
  const catalog = new Nyc311WarehouseCatalog(stack, "Nyc311WarehouseCatalog", { envName, warehouseBucket });
  const transformLambda = new Nyc311WarehouseTransformLambda(stack, "Nyc311WarehouseTransformLambda", { envName });
  const jobRunsTable = new WarehouseJobRunsTable(stack, "WarehouseJobRunsTable", { envName });

  const firehose = (label: string, table: string) =>
    new Nyc311WarehouseFirehose(stack, `Firehose${label}`, {
      envName,
      label,
      tableName: table,
      sourceTopic: new sns.Topic(stack, `Topic${label}`),
      glueTable: catalog.tables[table],
      warehouseBucket,
      transformLambda,
    });

  new Nyc311WarehouseRebuildLambda(stack, "Nyc311WarehouseRebuildLambda", {
    envName,
    warehouseBucket,
    jobRunsTable,
    orderEventsFirehose: firehose("OrderEvents", "order_events"),
    orderSnapshotsFirehose: firehose("OrderSnapshots", "order_snapshots"),
    requestsFirehose: firehose("Requests", "requests"),
    locationsFirehose: firehose("Locations", "locations"),
  });
  return Template.fromStack(stack);
}

/** Actions on the rebuild Lambda's own role policy only — the 4 Firehose delivery roles add their own noise to the stack. */
function rebuildRoleActions(template: Template): string[] {
  const actions = new Set<string>();
  for (const [logicalId, policy] of Object.entries(template.findResources("AWS::IAM::Policy"))) {
    if (!logicalId.startsWith("Nyc311WarehouseRebuildLambdaServiceRoleDefaultPolicy")) continue;
    const statements = (policy.Properties as { PolicyDocument: { Statement: { Action?: string | string[] }[] } })
      .PolicyDocument.Statement;
    for (const s of statements) {
      for (const a of Array.isArray(s.Action) ? s.Action : s.Action ? [s.Action] : []) actions.add(a);
    }
  }
  return [...actions];
}

describe("Nyc311WarehouseRebuildLambda", () => {
  it("bundles warehouseRebuildController on Node 22, named …RebuildWorker-<env>, 15-min timeout", () => {
    synth("TEST").hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.warehouseRebuildController",
      Runtime: "nodejs22.x",
      FunctionName: "Nyc311WarehouseRebuildWorker-Test",
      Timeout: 900,
      MemorySize: 1024,
    });
    synth("PROD").hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "Nyc311WarehouseRebuildWorker-Prod",
    });
  });

  it("passes the four Firehose names (as Refs) and the bucket/table as env", () => {
    synth("TEST").hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: Match.objectLike({
          WAREHOUSE_BUCKET_NAME: "nyc311-warehouse-test",
          ORDER_EVENTS_FIREHOSE_NAME: Match.objectLike({ Ref: Match.stringLikeRegexp("^FirehoseOrderEvents") }),
          ORDER_SNAPSHOTS_FIREHOSE_NAME: Match.objectLike({ Ref: Match.stringLikeRegexp("^FirehoseOrderSnapshots") }),
          REQUESTS_FIREHOSE_NAME: Match.objectLike({ Ref: Match.stringLikeRegexp("^FirehoseRequests") }),
          LOCATIONS_FIREHOSE_NAME: Match.objectLike({ Ref: Match.stringLikeRegexp("^FirehoseLocations") }),
          WAREHOUSE_JOB_RUNS_TABLE_NAME: Match.objectLike({ Ref: Match.stringLikeRegexp("^WarehouseJobRunsTable") }),
        }),
      },
    });
  });

  it("grants firehose:PutRecordBatch, scoped S3 read/delete, and dynamodb:PutItem only — no reads of the operational store", () => {
    expect(rebuildRoleActions(synth("TEST")).sort()).toEqual([
      "dynamodb:PutItem",
      "firehose:PutRecordBatch",
      "s3:DeleteObject",
      "s3:GetObject",
      "s3:ListBucket",
    ]);

    const json = JSON.stringify(synth("TEST").toJSON());
    expect(json).toContain("export-staging/*");
    expect(json).toContain("data/*");
  });

  it("gives the log group a DESTROY removal policy", () => {
    synth("TEST").hasResource("AWS::Logs::LogGroup", {
      DeletionPolicy: "Delete",
      Properties: { LogGroupName: "/aws/lambda/Nyc311WarehouseRebuildWorker-Test" },
    });
  });
});
