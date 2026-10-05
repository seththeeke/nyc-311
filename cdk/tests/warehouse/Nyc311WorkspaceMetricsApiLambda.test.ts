import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { FeatureFlagsTable } from "../../data/FeatureFlagsTable";
import { LiveWorkspaceMetricsTable } from "../../data/LiveWorkspaceMetricsTable";
import { WarehouseJobRunsTable } from "../../data/WarehouseJobRunsTable";
import { Nyc311WarehouseBucket } from "../../warehouse/Nyc311WarehouseBucket";
import { Nyc311WorkspaceMetricsApiLambda } from "../../warehouse/Nyc311WorkspaceMetricsApiLambda";

function synthesize(envName: "TEST" | "PROD" = "TEST"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const jobRunsTable = new WarehouseJobRunsTable(stack, "WarehouseJobRunsTable", { envName });
  const warehouseBucket = new Nyc311WarehouseBucket(stack, "Nyc311WarehouseBucket", { envName });
  const featureFlagsTable = new FeatureFlagsTable(stack, "FeatureFlagsTable", { envName });
  const liveWorkspaceMetricsTable = new LiveWorkspaceMetricsTable(stack, "LiveWorkspaceMetricsTable", { envName });
  new Nyc311WorkspaceMetricsApiLambda(stack, "Nyc311WorkspaceMetricsApiLambda", {
    envName,
    jobRunsTable,
    warehouseBucket,
    featureFlagsTable,
    liveWorkspaceMetricsTable,
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

describe("Nyc311WorkspaceMetricsApiLambda", () => {
  it("bundles getWorkspaceMetricsController on Node 22 with its three table names as env", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.getWorkspaceMetricsController",
      Runtime: "nodejs22.x",
      FunctionName: "Nyc311WorkspaceMetricsApi-Test",
      Environment: {
        Variables: Match.objectLike({
          WAREHOUSE_JOB_RUNS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^WarehouseJobRunsTable") },
          FEATURE_FLAGS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^FeatureFlagsTable") },
          LIVE_WORKSPACE_METRICS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^LiveWorkspaceMetricsTable") },
        }),
      },
    });
  });

  it("grants read-only actions only — Query (job runs), GetItem (flag), BatchGetItem (day buckets), s3:GetObject on job-results/*", () => {
    const actions = policyActions(synthesize("TEST")).filter(
      (a) => a.startsWith("dynamodb:") || a.startsWith("s3:")
    );
    expect(actions.sort()).toEqual(["dynamodb:BatchGetItem", "dynamodb:GetItem", "dynamodb:Query", "s3:GetObject"]);
    const json = JSON.stringify(synthesize("TEST").toJSON());
    expect(json).toContain("job-results/*");
  });

  it("scopes each DynamoDB action to its own table", () => {
    const statements = Object.values(synthesize("TEST").findResources("AWS::IAM::Policy")).flatMap(
      (policy) => (policy.Properties as { PolicyDocument: { Statement: { Action: string; Resource: unknown }[] } }).PolicyDocument.Statement
    );
    const tableFor = (action: string): string => JSON.stringify(statements.find((s) => s.Action === action)?.Resource);

    expect(tableFor("dynamodb:GetItem")).toContain("FeatureFlagsTable");
    expect(tableFor("dynamodb:BatchGetItem")).toContain("LiveWorkspaceMetricsTable");
    expect(tableFor("dynamodb:Query")).toContain("WarehouseJobRunsTable");
  });

  it("suffixes the function name by environment", () => {
    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311WorkspaceMetricsApi-Prod" });
  });
});
