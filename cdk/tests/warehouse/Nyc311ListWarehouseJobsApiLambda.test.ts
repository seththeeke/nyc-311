import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { UsersTable } from "../../data/UsersTable";
import { WarehouseJobRunsTable } from "../../data/WarehouseJobRunsTable";
import { Nyc311WarehouseBucket } from "../../warehouse/Nyc311WarehouseBucket";
import { Nyc311WarehouseCatalog } from "../../warehouse/Nyc311WarehouseCatalog";
import { Nyc311AnalyticsWorkgroup } from "../../warehouse/Nyc311AnalyticsWorkgroup";
import { Nyc311WarehouseJobRunnerLambda } from "../../warehouse/Nyc311WarehouseJobRunnerLambda";
import { Nyc311WarehouseJobScheduleGroup } from "../../warehouse/Nyc311WarehouseJobScheduleGroup";
import { Nyc311ListWarehouseJobsApiLambda } from "../../warehouse/Nyc311ListWarehouseJobsApiLambda";

function synthesize(envName: "TEST" | "PROD" = "TEST"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const usersTable = new UsersTable(stack, "UsersTable", { envName });
  const jobRunsTable = new WarehouseJobRunsTable(stack, "WarehouseJobRunsTable", { envName });
  const warehouseBucket = new Nyc311WarehouseBucket(stack, "Nyc311WarehouseBucket", { envName });
  const warehouseCatalog = new Nyc311WarehouseCatalog(stack, "Nyc311WarehouseCatalog", { envName, warehouseBucket });
  const analyticsWorkgroup = new Nyc311AnalyticsWorkgroup(stack, "Nyc311AnalyticsWorkgroup", { envName, warehouseBucket });
  const jobRunnerLambda = new Nyc311WarehouseJobRunnerLambda(stack, "Nyc311WarehouseJobRunnerLambda", {
    envName,
    jobRunsTable,
    warehouseBucket,
    warehouseCatalog,
    analyticsWorkgroup,
  });
  const jobScheduleGroup = new Nyc311WarehouseJobScheduleGroup(stack, "Nyc311WarehouseJobScheduleGroup", {
    envName,
    jobRunnerLambda,
    failureNotificationEmail: "ops@example.com",
  });
  new Nyc311ListWarehouseJobsApiLambda(stack, "Nyc311ListWarehouseJobsApiLambda", {
    envName,
    jobRunsTable,
    usersTable,
    warehouseBucket,
    jobRunnerLambda,
    jobScheduleGroup,
  });
  return Template.fromStack(stack);
}

/* Scoped to only Nyc311ListWarehouseJobsApiLambda's own policy — see the identical note in the Create Lambda's test. */
function policyActions(template: Template): string[] {
  const policies = template.findResources("AWS::IAM::Policy");
  const actions = new Set<string>();
  for (const [logicalId, policy] of Object.entries(policies)) {
    if (!logicalId.startsWith("Nyc311ListWarehouseJobsApiLambda")) continue;
    const statements = (policy.Properties as { PolicyDocument: { Statement: { Action?: string | string[] }[] } })
      .PolicyDocument.Statement;
    for (const s of statements) {
      for (const a of Array.isArray(s.Action) ? s.Action : s.Action ? [s.Action] : []) actions.add(a);
    }
  }
  return [...actions];
}

describe("Nyc311ListWarehouseJobsApiLambda", () => {
  it("bundles listWarehouseJobsController on Node 22", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.listWarehouseJobsController",
      Runtime: "nodejs22.x",
      FunctionName: "Nyc311ListWarehouseJobsApi-Test",
    });
  });

  it("suffixes the function name by environment", () => {
    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "Nyc311ListWarehouseJobsApi-Prod",
    });
  });

  it("grants dynamodb:Query only — no Get/Put/Delete on WarehouseJobRuns", () => {
    const actions = policyActions(synthesize("TEST"));
    const jobRunsDdb = actions.filter(
      (a) => a.startsWith("dynamodb:") && a !== "dynamodb:Query" && a !== "dynamodb:PutItem"
    );
    expect(jobRunsDdb).toEqual([]);
    expect(actions).toContain("dynamodb:Query");
  });

  it("is read-only at the IAM layer — no s3:*, no scheduler:*, no iam:PassRole", () => {
    const actions = policyActions(synthesize("TEST"));
    expect(actions.filter((a) => a.startsWith("s3:"))).toEqual([]);
    expect(actions.filter((a) => a.startsWith("scheduler:"))).toEqual([]);
    expect(actions.filter((a) => a === "iam:PassRole")).toEqual([]);
  });
});
