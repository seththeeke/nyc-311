import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { WebhookSubscriptionsTable } from "../../data/WebhookSubscriptionsTable";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  new WebhookSubscriptionsTable(stack, "WebhookSubscriptionsTable", { envName });
  return Template.fromStack(stack);
}

describe("WebhookSubscriptionsTable", () => {
  it("is keyed by subscription_id alone, with no GSIs and no stream", () => {
    const template = synthesize("TEST");
    template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      TableName: "WebhookSubscriptions-Test",
      KeySchema: [{ AttributeName: "subscription_id", KeyType: "HASH" }],
    });
    const table = Object.values(template.findResources("AWS::DynamoDB::GlobalTable"))[0];
    expect(table.Properties.GlobalSecondaryIndexes).toBeUndefined();
    expect(table.Properties.StreamSpecification).toBeUndefined();
  });

  it("is retained, with point-in-time recovery, and deletion-protected in Prod only", () => {
    const test = synthesize("TEST");
    test.hasResource("AWS::DynamoDB::GlobalTable", { DeletionPolicy: "Retain" });
    test.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      Replicas: [{ PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true }, DeletionProtectionEnabled: false }],
    });
    synthesize("PROD").hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      TableName: "WebhookSubscriptions-Prod",
      Replicas: [{ DeletionProtectionEnabled: true }],
    });
  });
});
