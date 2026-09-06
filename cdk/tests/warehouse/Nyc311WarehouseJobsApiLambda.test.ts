import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { WarehouseJobRunsTable } from "../../data/WarehouseJobRunsTable";
import { Nyc311WarehouseJobsApiLambda } from "../../warehouse/Nyc311WarehouseJobsApiLambda";

function synthesize(envName: "TEST" | "PROD" = "TEST"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const jobRunsTable = new WarehouseJobRunsTable(stack, "WarehouseJobRunsTable", { envName });
  new Nyc311WarehouseJobsApiLambda(stack, "Nyc311WarehouseJobsApiLambda", { envName, jobRunsTable });
  return Template.fromStack(stack);
}

function ddbActions(template: Template): string[] {
  const policies = template.findResources("AWS::IAM::Policy");
  const actions = new Set<string>();
  for (const policy of Object.values(policies)) {
    const statements = (policy.Properties as { PolicyDocument: { Statement: { Action?: string | string[] }[] } })
      .PolicyDocument.Statement;
    for (const s of statements) {
      for (const a of Array.isArray(s.Action) ? s.Action : s.Action ? [s.Action] : []) {
        if (a.startsWith("dynamodb:")) actions.add(a);
      }
    }
  }
  return [...actions];
}

describe("Nyc311WarehouseJobsApiLambda", () => {
  it("bundles getWarehouseJobRunsController on Node 22 with the table name as env", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.getWarehouseJobRunsController",
      Runtime: "nodejs22.x",
      FunctionName: "Nyc311WarehouseJobsApi-Test",
      Environment: {
        Variables: Match.objectLike({
          WAREHOUSE_JOB_RUNS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^WarehouseJobRunsTable") },
        }),
      },
    });
  });

  it("grants dynamodb:Query and nothing that writes", () => {
    expect(ddbActions(synthesize("TEST"))).toEqual(["dynamodb:Query"]);
  });

  it("suffixes the function name by environment", () => {
    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311WarehouseJobsApi-Prod" });
  });
});
