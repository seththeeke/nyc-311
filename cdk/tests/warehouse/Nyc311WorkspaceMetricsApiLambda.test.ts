import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { WarehouseJobRunsTable } from "../../data/WarehouseJobRunsTable";
import { Nyc311WarehouseBucket } from "../../warehouse/Nyc311WarehouseBucket";
import { Nyc311WorkspaceMetricsApiLambda } from "../../warehouse/Nyc311WorkspaceMetricsApiLambda";

function synthesize(envName: "TEST" | "PROD" = "TEST"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const jobRunsTable = new WarehouseJobRunsTable(stack, "WarehouseJobRunsTable", { envName });
  const warehouseBucket = new Nyc311WarehouseBucket(stack, "Nyc311WarehouseBucket", { envName });
  new Nyc311WorkspaceMetricsApiLambda(stack, "Nyc311WorkspaceMetricsApiLambda", { envName, jobRunsTable, warehouseBucket });
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
  it("bundles getWorkspaceMetricsController on Node 22 with the job-runs table name as env", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.getWorkspaceMetricsController",
      Runtime: "nodejs22.x",
      FunctionName: "Nyc311WorkspaceMetricsApi-Test",
      Environment: {
        Variables: Match.objectLike({
          WAREHOUSE_JOB_RUNS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^WarehouseJobRunsTable") },
        }),
      },
    });
  });

  it("grants dynamodb:Query + s3:GetObject on job-results/* only — nothing that writes", () => {
    const actions = policyActions(synthesize("TEST")).filter(
      (a) => a.startsWith("dynamodb:") || a.startsWith("s3:")
    );
    expect(actions.sort()).toEqual(["dynamodb:Query", "s3:GetObject"]);
    const json = JSON.stringify(synthesize("TEST").toJSON());
    expect(json).toContain("job-results/*");
  });

  it("suffixes the function name by environment", () => {
    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311WorkspaceMetricsApi-Prod" });
  });
});
