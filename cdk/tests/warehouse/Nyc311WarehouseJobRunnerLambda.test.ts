import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { WarehouseJobRunsTable } from "../../data/WarehouseJobRunsTable";
import { Nyc311WarehouseBucket } from "../../warehouse/Nyc311WarehouseBucket";
import { Nyc311WarehouseCatalog } from "../../warehouse/Nyc311WarehouseCatalog";
import { Nyc311AnalyticsWorkgroup } from "../../warehouse/Nyc311AnalyticsWorkgroup";
import { Nyc311WarehouseJobRunnerLambda } from "../../warehouse/Nyc311WarehouseJobRunnerLambda";

function synthesize(envName: "TEST" | "PROD" = "TEST"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const jobRunsTable = new WarehouseJobRunsTable(stack, "WarehouseJobRunsTable", { envName });
  const warehouseBucket = new Nyc311WarehouseBucket(stack, "Nyc311WarehouseBucket", { envName });
  const warehouseCatalog = new Nyc311WarehouseCatalog(stack, "Nyc311WarehouseCatalog", { envName, warehouseBucket });
  const analyticsWorkgroup = new Nyc311AnalyticsWorkgroup(stack, "Nyc311AnalyticsWorkgroup", { envName, warehouseBucket });
  new Nyc311WarehouseJobRunnerLambda(stack, "Nyc311WarehouseJobRunnerLambda", {
    envName,
    jobRunsTable,
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
  it("bundles runWarehouseJobController on Node 22 with the job manifest (from sql/) and warehouse config as env", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.runWarehouseJobController",
      Runtime: "nodejs22.x",
      FunctionName: "Nyc311WarehouseJobRunner-Test",
      Timeout: 300,
      Environment: {
        Variables: Match.objectLike({
          WAREHOUSE_JOBS: Match.stringLikeRegexp('"name":"order_volume_by_borough".*"name":"order_volume_by_stage_7d"'),
          JOB_RESULTS_BUCKET: "nyc311-warehouse-test",
          WAREHOUSE_DATABASE_NAME: "nyc311_warehouse_test",
          ATHENA_WORKGROUP: "Nyc311Analytics-Test",
          WAREHOUSE_JOB_RUNS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^WarehouseJobRunsTable") },
        }),
      },
    });
  });

  it("does not carry the removed ANALYTICS_ROLLUPS_TABLE_NAME / SAMPLE_JOB_SQL env vars", () => {
    const fn = Object.values(synthesize("TEST").findResources("AWS::Lambda::Function"))[0];
    const vars = (fn.Properties as { Environment: { Variables: Record<string, unknown> } }).Environment.Variables;
    expect(Object.keys(vars)).not.toContain("ANALYTICS_ROLLUPS_TABLE_NAME");
    expect(Object.keys(vars)).not.toContain("SAMPLE_JOB_SQL");
  });

  it("its log group is DESTROY so a failed first deploy's rollback cleans it up", () => {
    synthesize("TEST").hasResource("AWS::Logs::LogGroup", {
      Properties: Match.objectLike({ LogGroupName: "/aws/lambda/Nyc311WarehouseJobRunner-Test" }),
      DeletionPolicy: "Delete",
    });
  });

  it("grants Athena query start/poll/results and nothing that mutates the workgroup", () => {
    const athena = policyActions(synthesize("TEST"))
      .filter((a) => a.startsWith("athena:"))
      .sort();
    expect(athena).toEqual([
      "athena:GetQueryExecution",
      "athena:GetQueryResults",
      "athena:StartQueryExecution",
      "athena:StopQueryExecution",
    ]);
  });

  it("grants Glue catalog reads only — no Glue writes (the job_results table is CDK-declared)", () => {
    const actions = policyActions(synthesize("TEST"));
    expect(actions).toEqual(expect.arrayContaining(["glue:GetTable", "glue:GetTables", "glue:GetPartitions"]));
    expect(actions.filter((a) => a.startsWith("glue:") && !a.startsWith("glue:Get"))).toEqual([]);
  });

  it("its DynamoDB grants are GetItem/PutItem/Query on WarehouseJobRuns only — no Delete/UpdateItem", () => {
    const ddb = policyActions(synthesize("TEST")).filter((a) => a.startsWith("dynamodb:"));
    expect(ddb.sort()).toEqual(["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query"]);
  });

  it("its S3 grants are read on data/*, read+write on job-results/* and athena-results/*, delete on athena-results/*", () => {
    const template = synthesize("TEST");
    const s3 = policyActions(template)
      .filter((a) => a.startsWith("s3:"))
      .sort();
    expect(s3).toEqual(["s3:DeleteObject", "s3:GetBucketLocation", "s3:GetObject", "s3:ListBucket", "s3:PutObject"]);

    /* the s3:PutObject statement's resources name job-results/ and athena-results/, not data/ */
    const json = JSON.stringify(template.toJSON());
    expect(json).toContain("job-results/*");
    expect(json).not.toMatch(/"[^"]*data\/\*"[^}]*s3:PutObject/);
  });

  it("suffixes the function name by environment", () => {
    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311WarehouseJobRunner-Prod" });
  });
});
