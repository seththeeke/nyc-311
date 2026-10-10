import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { WebhookSinkDeliveriesTable } from "../../data/WebhookSinkDeliveriesTable";

function synthesize(): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  new WebhookSinkDeliveriesTable(stack, "WebhookSinkDeliveriesTable", { envName: "TEST" });
  return Template.fromStack(stack);
}

describe("WebhookSinkDeliveriesTable", () => {
  it("is keyed by webhook_id and expires rows by TTL on expires_at", () => {
    synthesize().hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      TableName: "WebhookSinkDeliveries-Test",
      KeySchema: [{ AttributeName: "webhook_id", KeyType: "HASH" }],
      TimeToLiveSpecification: { AttributeName: "expires_at", Enabled: true },
    });
  });

  it("is disposable — destroyed with the stack", () => {
    synthesize().hasResource("AWS::DynamoDB::GlobalTable", { DeletionPolicy: "Delete" });
  });
});
