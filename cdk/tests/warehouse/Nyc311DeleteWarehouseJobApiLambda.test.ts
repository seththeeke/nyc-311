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
import { Nyc311DeleteWarehouseJobApiLambda } from "../../warehouse/Nyc311DeleteWarehouseJobApiLambda";

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
  new Nyc311DeleteWarehouseJobApiLambda(stack, "Nyc311DeleteWarehouseJobApiLambda", {
    envName,
    jobRunsTable,
    usersTable,
    warehouseBucket,
    jobRunnerLambda,
    jobScheduleGroup,
  });
  return Template.fromStack(stack);
}

/* Scoped to only Nyc311DeleteWarehouseJobApiLambda's own policy — see the identical note in the Create Lambda's test. */
function policyActions(template: Template): string[] {
  const policies = template.findResources("AWS::IAM::Policy");
  const actions = new Set<string>();
  for (const [logicalId, policy] of Object.entries(policies)) {
    if (!logicalId.startsWith("Nyc311DeleteWarehouseJobApiLambda")) continue;
    const statements = (policy.Properties as { PolicyDocument: { Statement: { Action?: string | string[] }[] } })
      .PolicyDocument.Statement;
    for (const s of statements) {
      for (const a of Array.isArray(s.Action) ? s.Action : s.Action ? [s.Action] : []) actions.add(a);
    }
  }
  return [...actions];
}

describe("Nyc311DeleteWarehouseJobApiLambda", () => {
  it("bundles deleteWarehouseJobController on Node 22", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.deleteWarehouseJobController",
      Runtime: "nodejs22.x",
      FunctionName: "Nyc311DeleteWarehouseJobApi-Test",
    });
  });

  it("suffixes the function name by environment", () => {
    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "Nyc311DeleteWarehouseJobApi-Prod",
    });
  });

  it("grants GetItem+DeleteItem on WarehouseJobRuns only", () => {
    const actions = policyActions(synthesize("TEST"));
    const jobRunsDdb = actions.filter((a) => a.startsWith("dynamodb:") && a !== "dynamodb:Query" && a !== "dynamodb:PutItem");
    expect(jobRunsDdb.sort()).toEqual(["dynamodb:DeleteItem", "dynamodb:GetItem"]);
  });

  it("grants s3:DeleteObject scoped to job-definitions/* only", () => {
    const template = synthesize("TEST");
    const s3 = policyActions(template).filter((a) => a.startsWith("s3:"));
    expect(s3).toEqual(["s3:DeleteObject"]);

    const json = JSON.stringify(template.toJSON());
    expect(json).toContain("job-definitions/*");
  });

  it("grants scheduler:DeleteSchedule only — no CreateSchedule, no GetSchedule", () => {
    const actions = policyActions(synthesize("TEST"));
    const scheduler = actions.filter((a) => a.startsWith("scheduler:"));
    expect(scheduler).toEqual(["scheduler:DeleteSchedule"]);
  });

  it("grants no iam:PassRole at all — deleting a schedule never needs it", () => {
    const actions = policyActions(synthesize("TEST"));
    expect(actions.filter((a) => a === "iam:PassRole")).toEqual([]);
  });
});
