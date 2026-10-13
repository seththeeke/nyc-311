import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { WebhookCustomerFacingOrdersTable } from "../../customer/WebhookCustomerFacingOrdersTable";

function synthesize(): Template {
  const stack = new Stack(new App(), "TestStack", { env: { region: "us-east-1" } });
  new WebhookCustomerFacingOrdersTable(stack, "WebhookCustomerFacingOrdersTable");
  return Template.fromStack(stack);
}

describe("WebhookCustomerFacingOrdersTable", () => {
  it("is keyed by order_id alone and expires rows by TTL on expires_at", () => {
    synthesize().hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      TableName: "WebhookCustomerFacingOrders-Prod",
      KeySchema: [{ AttributeName: "order_id", KeyType: "HASH" }],
      TimeToLiveSpecification: { AttributeName: "expires_at", Enabled: true },
    });
  });

  it("has no index and no stream, and is destroyed with the stack", () => {
    const template = synthesize();
    const table = Object.values(template.findResources("AWS::DynamoDB::GlobalTable"))[0];
    expect(table.Properties.GlobalSecondaryIndexes).toBeUndefined();
    expect(table.Properties.StreamSpecification).toBeUndefined();
    template.hasResource("AWS::DynamoDB::GlobalTable", { DeletionPolicy: "Delete" });
  });
});
