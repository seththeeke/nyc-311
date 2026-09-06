import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { WarehouseJobRunsTable } from "../../data/WarehouseJobRunsTable";
import { AnalyticsRollupsTable } from "../../data/AnalyticsRollupsTable";
import { Nyc311WarehouseBucket } from "../../warehouse/Nyc311WarehouseBucket";
import { Nyc311WarehouseCatalog } from "../../warehouse/Nyc311WarehouseCatalog";
import { Nyc311AnalyticsWorkgroup } from "../../warehouse/Nyc311AnalyticsWorkgroup";
import { Nyc311WarehouseJobRunnerLambda } from "../../warehouse/Nyc311WarehouseJobRunnerLambda";

function synthesize(envName: "TEST" | "PROD" = "TEST"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const jobRunsTable = new WarehouseJobRunsTable(stack, "WarehouseJobRunsTable", { envName });
  const rollupsTable = new AnalyticsRollupsTable(stack, "AnalyticsRollupsTable", { envName });
  const warehouseBucket = new Nyc311WarehouseBucket(stack, "Nyc311WarehouseBucket", { envName });
  const warehouseCatalog = new Nyc311WarehouseCatalog(stack, "Nyc311WarehouseCatalog", { envName, warehouseBucket });
  const analyticsWorkgroup = new Nyc311AnalyticsWorkgroup(stack, "Nyc311AnalyticsWorkgroup", { envName, warehouseBucket });
  new Nyc311WarehouseJobRunnerLambda(stack, "Nyc311WarehouseJobRunnerLambda", {
    envName,
    jobRunsTable,
    rollupsTable,
    warehouseBucket,
    warehouseCatalog,
    analyticsWorkgroup,
  });
  return Template.fromStack(stack);
}

function policyActions(template: Template): string[] {
  const policies = template.findResources("AWS::IAM::Policy");
  const actions = new Set<string>();
  for (const policy of Object.values(policies)) {
    const statements = (policy.Properties as { PolicyDocument: { Statement: { Action?: string | string[] }[] } })
      .PolicyDocument.Statement;
    for (const s of statements) {
      for (const a of Array.isArray(s.Action) ? s.Action : s.Action ? [s.Action] : []) actions.add(a);
    }
  }
  return [...actions];
}

describe("Nyc311WarehouseJobRunnerLambda", () => {
  it("bundles runWarehouseJobController's exported handler on Node 22 with the sample SQL and warehouse config as env", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.runWarehouseJobController",
      Runtime: "nodejs22.x",
      FunctionName: "Nyc311WarehouseJobRunner-Test",
      Timeout: 180,
      Environment: {
        Variables: Match.objectLike({
          SAMPLE_JOB_SQL: Match.stringLikeRegexp("order_snapshots"),
          WAREHOUSE_DATABASE_NAME: "nyc311_warehouse_test",
          ATHENA_WORKGROUP: "Nyc311Analytics-Test",
          WAREHOUSE_JOB_RUNS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^WarehouseJobRunsTable") },
          ANALYTICS_ROLLUPS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^AnalyticsRollupsTable") },
        }),
      },
    });
  });

  it("its log group is DESTROY so a failed first deploy's rollback cleans it up", () => {
    synthesize("TEST").hasResource("AWS::Logs::LogGroup", {
      Properties: Match.objectLike({ LogGroupName: "/aws/lambda/Nyc311WarehouseJobRunner-Test" }),
      DeletionPolicy: "Delete",
    });
  });

  it("grants Athena query start/poll/results and nothing that mutates the workgroup", () => {
    const actions = policyActions(synthesize("TEST"));
    const athena = actions.filter((a) => a.startsWith("athena:")).sort();
    expect(athena).toEqual([
      "athena:GetQueryExecution",
      "athena:GetQueryResults",
      "athena:StartQueryExecution",
      "athena:StopQueryExecution",
    ]);
  });

  it("grants Glue catalog reads and no Glue writes", () => {
    const actions = policyActions(synthesize("TEST"));
    expect(actions).toEqual(expect.arrayContaining(["glue:GetTable", "glue:GetTables", "glue:GetPartitions"]));
    expect(actions.filter((a) => a.startsWith("glue:") && !a.startsWith("glue:Get"))).toEqual([]);
  });

  it("its DynamoDB grants are GetItem/PutItem/Query on WarehouseJobRuns and PutItem-only on AnalyticsRollups — no Delete/UpdateItem", () => {
    const actions = policyActions(synthesize("TEST"));
    const ddb = actions.filter((a) => a.startsWith("dynamodb:"));
    expect(ddb.sort()).toEqual(["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query"]);
  });

  it("suffixes the function name by environment", () => {
    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311WarehouseJobRunner-Prod" });
  });
});
