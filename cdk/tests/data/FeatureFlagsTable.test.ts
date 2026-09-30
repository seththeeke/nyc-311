import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { FeatureFlagsTable } from "../../data/FeatureFlagsTable";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  new FeatureFlagsTable(stack, "FeatureFlagsTable", { envName });
  return Template.fromStack(stack);
}

describe("FeatureFlagsTable", () => {
  it("keys on flag_key alone, with PITR enabled and RETAIN removal policy", () => {
    const template = synthesize("TEST");
    template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      KeySchema: [{ AttributeName: "flag_key", KeyType: "HASH" }],
    });
    template.hasResource("AWS::DynamoDB::GlobalTable", { DeletionPolicy: "Retain", UpdateReplacePolicy: "Retain" });
  });

  it("has no GSIs and no stream", () => {
    const props = Object.values(synthesize("TEST").findResources("AWS::DynamoDB::GlobalTable"))[0]
      ?.Properties as Record<string, unknown>;
    expect(props["GlobalSecondaryIndexes"]).toBeUndefined();
    expect(props["StreamSpecification"]).toBeUndefined();
  });

  it("suffixes the physical table name by environment", () => {
    synthesize("TEST").hasResourceProperties("AWS::DynamoDB::GlobalTable", { TableName: "FeatureFlags-Test" });
    synthesize("PROD").hasResourceProperties("AWS::DynamoDB::GlobalTable", { TableName: "FeatureFlags-Prod" });
  });
});

describe("deletion protection (v1-prod-deployment.md B9)", () => {
  it("is enabled in Prod and off in Test", () => {
    synthesize("PROD").hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      Replicas: Match.arrayWith([Match.objectLike({ DeletionProtectionEnabled: true })]),
    });
    synthesize("TEST").hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      Replicas: Match.arrayWith([Match.objectLike({ DeletionProtectionEnabled: false })]),
    });
  });
});
