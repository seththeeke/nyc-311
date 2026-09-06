import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { AnalyticsRollupsTable } from "../../data/AnalyticsRollupsTable";
import { Nyc311RollupsApiLambda } from "../../warehouse/Nyc311RollupsApiLambda";

function synthesize(envName: "TEST" | "PROD" = "TEST"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const rollupsTable = new AnalyticsRollupsTable(stack, "AnalyticsRollupsTable", { envName });
  new Nyc311RollupsApiLambda(stack, "Nyc311RollupsApiLambda", { envName, rollupsTable });
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

describe("Nyc311RollupsApiLambda", () => {
  it("bundles getRollupsController on Node 22 with the table name as env", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.getRollupsController",
      Runtime: "nodejs22.x",
      FunctionName: "Nyc311RollupsApi-Test",
      Environment: {
        Variables: Match.objectLike({
          ANALYTICS_ROLLUPS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^AnalyticsRollupsTable") },
        }),
      },
    });
  });

  it("grants dynamodb:Query and nothing that writes", () => {
    expect(ddbActions(synthesize("TEST"))).toEqual(["dynamodb:Query"]);
  });

  it("suffixes the function name by environment", () => {
    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311RollupsApi-Prod" });
  });
});
