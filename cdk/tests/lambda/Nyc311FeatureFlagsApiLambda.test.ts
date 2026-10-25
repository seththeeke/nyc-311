import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { beforeAll, describe, expect, it } from "vitest";
import { FeatureFlagsTable } from "../../data/FeatureFlagsTable";
import { Nyc311FeatureFlagsApiLambda } from "../../lambda/Nyc311FeatureFlagsApiLambda";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  new Nyc311FeatureFlagsApiLambda(stack, "Nyc311FeatureFlagsApiLambda", {
    envName,
    featureFlagsTable: new FeatureFlagsTable(stack, "FeatureFlagsTable", { envName }),
  });
  return Template.fromStack(stack);
}

type Statement = { Action?: string | string[]; Resource?: unknown };

function statementsOf(template: Template): Statement[] {
  return Object.values(template.findResources("AWS::IAM::Policy")).flatMap(
    (policy) => (policy.Properties as { PolicyDocument: { Statement: Statement[] } }).PolicyDocument.Statement
  );
}

function actionsOf(template: Template): string[] {
  return [...new Set(statementsOf(template).flatMap((s) => (Array.isArray(s.Action) ? s.Action : s.Action ? [s.Action] : [])))].sort();
}

function envKeysOf(template: Template): string[] {
  const [fn] = Object.values(template.findResources("AWS::Lambda::Function"));
  return Object.keys((fn.Properties as { Environment: { Variables: Record<string, unknown> } }).Environment.Variables).sort();
}

describe("Nyc311FeatureFlagsApiLambda", () => {
  let testTemplate: Template;

  beforeAll(() => {
    testTemplate = synthesize("TEST");
  });

  it("bundles the featureFlagsApiRouter on Node 22", () => {
    testTemplate.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "Nyc311FeatureFlagsApi-Test",
      Handler: "index.featureFlagsApiRouter",
      Runtime: "nodejs22.x",
      Timeout: 10,
      MemorySize: 512,
    });
  });

  it("suffixes the function and log group by environment, and destroys the log group with the stack", () => {
    testTemplate.hasResource("AWS::Logs::LogGroup", {
      Properties: { LogGroupName: "/aws/lambda/Nyc311FeatureFlagsApi-Test", RetentionInDays: 30 },
      DeletionPolicy: "Delete",
    });
    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311FeatureFlagsApi-Prod" });
  });

  it("carries only the flags table name", () => {
    expect(envKeysOf(testTemplate)).toEqual(["FEATURE_FLAGS_TABLE_NAME"]);
  });

  it("only reads the flags table: Scan for the list, GetItem for get and getTreatment — no writes, no Users table", () => {
    expect(actionsOf(testTemplate)).toEqual(["dynamodb:GetItem", "dynamodb:Scan"]);
  });
});
