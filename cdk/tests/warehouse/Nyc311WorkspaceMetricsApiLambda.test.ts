import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { LiveWorkspaceMetricsTable } from "../../data/LiveWorkspaceMetricsTable";
import { Nyc311WorkspaceMetricsApiLambda } from "../../warehouse/Nyc311WorkspaceMetricsApiLambda";

function synthesize(envName: "TEST" | "PROD" = "TEST"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const liveWorkspaceMetricsTable = new LiveWorkspaceMetricsTable(stack, "LiveWorkspaceMetricsTable", { envName });
  new Nyc311WorkspaceMetricsApiLambda(stack, "Nyc311WorkspaceMetricsApiLambda", { envName, liveWorkspaceMetricsTable });
  return Template.fromStack(stack);
}

interface Statement {
  Action?: string | string[];
  Resource: unknown;
}

function statements(template: Template): Statement[] {
  return Object.values(template.findResources("AWS::IAM::Policy")).flatMap(
    (policy) => (policy.Properties as { PolicyDocument: { Statement: Statement[] } }).PolicyDocument.Statement
  );
}

describe("Nyc311WorkspaceMetricsApiLambda", () => {
  it("bundles getWorkspaceMetricsController on Node 22 with only the live metrics table name as env", () => {
    const template = synthesize("TEST");
    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.getWorkspaceMetricsController",
      Runtime: "nodejs22.x",
      FunctionName: "Nyc311WorkspaceMetricsApi-Test",
      Environment: {
        Variables: Match.objectLike({ LIVE_WORKSPACE_METRICS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^LiveWorkspaceMetricsTable") } }),
      },
    });
    const variables = Object.values(template.findResources("AWS::Lambda::Function")).map(
      (fn) => Object.keys((fn.Properties as { Environment: { Variables: Record<string, unknown> } }).Environment.Variables)
    );
    expect(variables[0]).not.toContain("FEATURE_FLAGS_TABLE_NAME");
    expect(variables[0]).not.toContain("WAREHOUSE_JOB_RUNS_TABLE_NAME");
  });

  it("grants only BatchGetItem, scoped to the live metrics table, and nothing on S3", () => {
    const granted = statements(synthesize("TEST")).flatMap((s) => {
      const actions = Array.isArray(s.Action) ? s.Action : s.Action ? [s.Action] : [];
      return actions.filter((a) => a.startsWith("dynamodb:") || a.startsWith("s3:")).map((a) => ({ a, resource: JSON.stringify(s.Resource) }));
    });
    expect(granted.map((g) => g.a)).toEqual(["dynamodb:BatchGetItem"]);
    expect(granted[0].resource).toContain("LiveWorkspaceMetricsTable");
  });

  it("suffixes the function name by environment", () => {
    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311WorkspaceMetricsApi-Prod" });
  });
});
