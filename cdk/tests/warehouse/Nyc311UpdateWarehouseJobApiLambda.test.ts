import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { UsersTable } from "../../data/UsersTable";
import { WarehouseJobRunsTable } from "../../data/WarehouseJobRunsTable";
import { Nyc311WarehouseBucket } from "../../warehouse/Nyc311WarehouseBucket";
import { Nyc311WarehouseCatalog } from "../../warehouse/Nyc311WarehouseCatalog";
import { Nyc311AnalyticsWorkgroup } from "../../warehouse/Nyc311AnalyticsWorkgroup";
import { Nyc311WarehouseJobRunnerLambda } from "../../warehouse/Nyc311WarehouseJobRunnerLambda";
import { Nyc311WarehouseJobScheduleGroup } from "../../warehouse/Nyc311WarehouseJobScheduleGroup";
import { Nyc311UpdateWarehouseJobApiLambda } from "../../warehouse/Nyc311UpdateWarehouseJobApiLambda";

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
  new Nyc311UpdateWarehouseJobApiLambda(stack, "Nyc311UpdateWarehouseJobApiLambda", {
    envName,
    jobRunsTable,
    usersTable,
    warehouseBucket,
    jobRunnerLambda,
    jobScheduleGroup,
  });
  return Template.fromStack(stack);
}

/*
 * Scoped to only the policy attached to Nyc311UpdateWarehouseJobApiLambda's
 * own role — same reasoning as Nyc311CreateWarehouseJobApiLambda.test.ts.
 */
function policyActions(template: Template): string[] {
  const policies = template.findResources("AWS::IAM::Policy");
  const actions = new Set<string>();
  for (const [logicalId, policy] of Object.entries(policies)) {
    if (!logicalId.startsWith("Nyc311UpdateWarehouseJobApiLambda")) continue;
    const statements = (policy.Properties as { PolicyDocument: { Statement: { Action?: string | string[] }[] } })
      .PolicyDocument.Statement;
    for (const s of statements) {
      for (const a of Array.isArray(s.Action) ? s.Action : s.Action ? [s.Action] : []) actions.add(a);
    }
  }
  return [...actions];
}

describe("Nyc311UpdateWarehouseJobApiLambda", () => {
  it("bundles updateWarehouseJobController on Node 22", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.updateWarehouseJobController",
      Runtime: "nodejs22.x",
      FunctionName: "Nyc311UpdateWarehouseJobApi-Test",
    });
  });

  it("suffixes the function name by environment", () => {
    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "Nyc311UpdateWarehouseJobApi-Prod",
    });
  });

  it("grants GetItem and PutItem on WarehouseJobRuns — no Delete", () => {
    const actions = policyActions(synthesize("TEST"));
    expect(actions).toContain("dynamodb:GetItem");
    expect(actions).toContain("dynamodb:PutItem");
    expect(actions).not.toContain("dynamodb:DeleteItem");
  });

  it("grants s3:PutObject scoped to job-definitions/* only", () => {
    const template = synthesize("TEST");
    const s3 = policyActions(template).filter((a) => a.startsWith("s3:"));
    expect(s3).toEqual(["s3:PutObject"]);

    const json = JSON.stringify(template.toJSON());
    expect(json).toContain("job-definitions/*");
  });

  it("grants scheduler:UpdateSchedule scoped to the schedule group, and nothing else", () => {
    const actions = policyActions(synthesize("TEST"));
    const scheduler = actions.filter((a) => a.startsWith("scheduler:"));
    expect(scheduler).toEqual(["scheduler:UpdateSchedule"]);
  });

  it("grants iam:PassRole scoped to exactly the invocation role's ARN, never a wildcard", () => {
    const template = synthesize("TEST");
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: "iam:PassRole",
            Effect: "Allow",
            Resource: { "Fn::GetAtt": [Match.stringLikeRegexp("^Nyc311WarehouseJobScheduleGroupInvocationRole"), "Arn"] },
          }),
        ]),
      }),
    });

    const actions = policyActions(template);
    expect(actions.filter((a) => a === "iam:PassRole")).toHaveLength(1);
  });
});
