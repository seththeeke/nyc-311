import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { LiveWorkspaceMetricsTable } from "../../data/LiveWorkspaceMetricsTable";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  new LiveWorkspaceMetricsTable(stack, "LiveWorkspaceMetricsTable", { envName });
  return Template.fromStack(stack);
}

describe("LiveWorkspaceMetricsTable", () => {
  it("keys on metric_key alone, with PITR enabled and RETAIN removal policy", () => {
    const template = synthesize("TEST");
    template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      KeySchema: [{ AttributeName: "metric_key", KeyType: "HASH" }],
      Replicas: Match.arrayWith([
        Match.objectLike({ PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true } }),
      ]),
    });
    template.hasResource("AWS::DynamoDB::GlobalTable", { DeletionPolicy: "Retain", UpdateReplacePolicy: "Retain" });
  });

  it("expires SEEN markers via TTL on expires_at", () => {
    synthesize("TEST").hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      TimeToLiveSpecification: { AttributeName: "expires_at", Enabled: true },
    });
  });

  it("has no GSIs and no stream", () => {
    const props = Object.values(synthesize("TEST").findResources("AWS::DynamoDB::GlobalTable"))[0]
      ?.Properties as Record<string, unknown>;
    expect(props["GlobalSecondaryIndexes"]).toBeUndefined();
    expect(props["StreamSpecification"]).toBeUndefined();
  });

  it("suffixes the physical table name by environment", () => {
    synthesize("TEST").hasResourceProperties("AWS::DynamoDB::GlobalTable", { TableName: "LiveWorkspaceMetrics-Test" });
    synthesize("PROD").hasResourceProperties("AWS::DynamoDB::GlobalTable", { TableName: "LiveWorkspaceMetrics-Prod" });
  });

  it("enables deletion protection in Prod and leaves it off in Test (v1-prod-deployment.md B9)", () => {
    synthesize("PROD").hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      Replicas: Match.arrayWith([Match.objectLike({ DeletionProtectionEnabled: true })]),
    });
    synthesize("TEST").hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      Replicas: Match.arrayWith([Match.objectLike({ DeletionProtectionEnabled: false })]),
    });
  });
});
