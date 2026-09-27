import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { FeatureFlagsTable } from "../../data/FeatureFlagsTable";
import { UsersTable } from "../../data/UsersTable";
import {
  FEATURE_FLAG_API_OPERATIONS,
  FEATURE_FLAG_OPERATION_CONFIG,
  Nyc311FeatureFlagApiLambda,
  type FeatureFlagApiOperation,
} from "../../lambda/Nyc311FeatureFlagApiLambda";

function synthesize(operation: FeatureFlagApiOperation, envName: "TEST" | "PROD" = "TEST"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const featureFlagsTable = new FeatureFlagsTable(stack, "FeatureFlagsTable", { envName });
  const usersTable = new UsersTable(stack, "UsersTable", { envName });
  new Nyc311FeatureFlagApiLambda(stack, "Fn", { envName, operation, featureFlagsTable, usersTable });
  return Template.fromStack(stack);
}

function policyActions(template: Template): unknown[] {
  return Object.values(template.findResources("AWS::IAM::Policy")).flatMap(
    (policy) => (policy.Properties as { PolicyDocument: { Statement: { Action: unknown }[] } }).PolicyDocument.Statement.map((s) => s.Action)
  );
}

describe("Nyc311FeatureFlagApiLambda", () => {
  it.each(FEATURE_FLAG_API_OPERATIONS)("%s bundles its controller on Node 22 with an env-suffixed name and log group", (operation) => {
    const config = FEATURE_FLAG_OPERATION_CONFIG[operation];
    const template = synthesize(operation);
    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: `index.${config.controller}`,
      Runtime: "nodejs22.x",
      FunctionName: `${config.functionStem}-Test`,
    });
    template.hasResourceProperties("AWS::Logs::LogGroup", { LogGroupName: `/aws/lambda/${config.functionStem}-Test` });
    template.hasResource("AWS::Logs::LogGroup", { DeletionPolicy: "Delete" });
    synthesize(operation, "PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: `${config.functionStem}-Prod` });
  });

  it.each(["LIST", "GET", "GET_TREATMENT"] as const)("%s is public: FeatureFlags access only, no UsersTable", (operation) => {
    const template = synthesize(operation);
    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: { Variables: { FEATURE_FLAGS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^FeatureFlagsTable") } } },
    });
    const vars = (Object.values(template.findResources("AWS::Lambda::Function"))[0]?.Properties as {
      Environment: { Variables: Record<string, unknown> };
    }).Environment.Variables;
    expect(vars["USERS_TABLE_NAME"]).toBeUndefined();
    expect(policyActions(template)).not.toContainEqual(["dynamodb:Query", "dynamodb:PutItem"]);
  });

  it.each(["CREATE", "UPDATE", "DELETE"] as const)("%s is admin: also gets UsersTable Query+PutItem", (operation) => {
    const template = synthesize(operation);
    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: {
          FEATURE_FLAGS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^FeatureFlagsTable") },
          USERS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^UsersTable") },
        },
      },
    });
    expect(policyActions(template)).toContainEqual(["dynamodb:Query", "dynamodb:PutItem"]);
  });

  it("grants each operation only its own FeatureFlags actions", () => {
    expect(policyActions(synthesize("LIST"))).toContainEqual("dynamodb:Scan");
    expect(policyActions(synthesize("GET_TREATMENT"))).toContainEqual("dynamodb:GetItem");
    expect(policyActions(synthesize("CREATE"))).toContainEqual("dynamodb:PutItem");
    expect(policyActions(synthesize("UPDATE"))).toContainEqual(["dynamodb:GetItem", "dynamodb:PutItem"]);
    expect(policyActions(synthesize("DELETE"))).toContainEqual("dynamodb:DeleteItem");
    expect(policyActions(synthesize("GET_TREATMENT"))).not.toContainEqual("dynamodb:PutItem");
  });
});
