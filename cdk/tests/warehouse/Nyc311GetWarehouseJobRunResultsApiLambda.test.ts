import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { UsersTable } from "../../data/UsersTable";
import { WarehouseJobRunsTable } from "../../data/WarehouseJobRunsTable";
import { Nyc311WarehouseBucket } from "../../warehouse/Nyc311WarehouseBucket";
import { Nyc311GetWarehouseJobRunResultsApiLambda } from "../../warehouse/Nyc311GetWarehouseJobRunResultsApiLambda";

function synthesize(envName: "TEST" | "PROD" = "TEST"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const usersTable = new UsersTable(stack, "UsersTable", { envName });
  const jobRunsTable = new WarehouseJobRunsTable(stack, "WarehouseJobRunsTable", { envName });
  const warehouseBucket = new Nyc311WarehouseBucket(stack, "Nyc311WarehouseBucket", { envName });
  new Nyc311GetWarehouseJobRunResultsApiLambda(stack, "Nyc311GetWarehouseJobRunResultsApiLambda", {
    envName,
    jobRunsTable,
    usersTable,
    warehouseBucket,
  });
  return Template.fromStack(stack);
}

/* Scoped to only this Lambda's own policy — see the identical note in the sibling GetWarehouseJobSql Lambda's test. */
function policyActions(template: Template): string[] {
  const policies = template.findResources("AWS::IAM::Policy");
  const actions = new Set<string>();
  for (const [logicalId, policy] of Object.entries(policies)) {
    if (!logicalId.startsWith("Nyc311GetWarehouseJobRunResultsApiLambda")) continue;
    const statements = (policy.Properties as { PolicyDocument: { Statement: { Action?: string | string[] }[] } })
      .PolicyDocument.Statement;
    for (const s of statements) {
      for (const a of Array.isArray(s.Action) ? s.Action : s.Action ? [s.Action] : []) actions.add(a);
    }
  }
  return [...actions];
}

describe("Nyc311GetWarehouseJobRunResultsApiLambda", () => {
  it("bundles postJobRunResultsController on Node 22", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.postJobRunResultsController",
      Runtime: "nodejs22.x",
      FunctionName: "Nyc311GetWarehouseJobRunResultsApi-Test",
    });
  });

  it("suffixes the function name by environment", () => {
    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "Nyc311GetWarehouseJobRunResultsApi-Prod",
    });
  });

  it("grants GetItem on WarehouseJobRuns only — a primary-key lookup per id, not a Query", () => {
    const actions = policyActions(synthesize("TEST"));
    const jobRunsDdb = actions.filter((a) => a.startsWith("dynamodb:") && a !== "dynamodb:Query" && a !== "dynamodb:PutItem");
    expect(jobRunsDdb).toEqual(["dynamodb:GetItem"]);
  });

  it("grants s3:GetObject scoped to job-results/* only", () => {
    const template = synthesize("TEST");
    const s3 = policyActions(template).filter((a) => a.startsWith("s3:"));
    expect(s3).toEqual(["s3:GetObject"]);

    const json = JSON.stringify(template.toJSON());
    expect(json).toContain("job-results/*");
  });

  it("grants no scheduler:* permissions at all — never touches a job definition or schedule", () => {
    const actions = policyActions(synthesize("TEST"));
    expect(actions.filter((a) => a.startsWith("scheduler:"))).toEqual([]);
  });

  it("grants no iam:PassRole at all", () => {
    const actions = policyActions(synthesize("TEST"));
    expect(actions.filter((a) => a === "iam:PassRole")).toEqual([]);
  });
});
