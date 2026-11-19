import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { describe, expect, it } from "vitest";
import { FeatureFlagsTable } from "../../data/FeatureFlagsTable";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  new FeatureFlagsTable(stack, "FeatureFlagsTable", { envName });
  return Template.fromStack(stack);
}

describe("FeatureFlagsTable", () => {
  it("keys on flag_key alone, with RETAIN removal policy", () => {
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

describe("grantFlagRead (#202)", () => {
  it("grants dynamodb:GetItem on this table's ARN and nothing else", () => {
    const app = new App();
    const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
    const table = new FeatureFlagsTable(stack, "FeatureFlagsTable", { envName: "TEST" });
    const role = new Role(stack, "CallerRole", { assumedBy: new ServicePrincipal("lambda.amazonaws.com") });
    table.grantFlagRead(role);
    const template = Template.fromStack(stack);

    const policies = Object.values(template.findResources("AWS::IAM::Policy"));
    expect(policies).toHaveLength(1);
    const statements = (policies[0]?.Properties as { PolicyDocument: { Statement: Record<string, unknown>[] } }).PolicyDocument.Statement;
    expect(statements).toHaveLength(1);
    expect(statements[0]?.["Action"]).toBe("dynamodb:GetItem");
    expect(statements[0]?.["Effect"]).toBe("Allow");
    expect(JSON.stringify(statements[0]?.["Resource"])).toContain("FeatureFlagsTable");
    expect(JSON.stringify(statements[0]?.["Resource"])).not.toContain("/index/");
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

describe("point-in-time recovery (#242 — Test's PITR storage is waste on disposable data)", () => {
  it("is enabled in Prod and off in Test", () => {
    synthesize("PROD").hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      Replicas: Match.arrayWith([Match.objectLike({ PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true } })]),
    });
    synthesize("TEST").hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      Replicas: Match.arrayWith([Match.objectLike({ PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: false } })]),
    });
  });
});
