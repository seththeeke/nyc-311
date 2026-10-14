import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { CustomerWebhookListenerLambda } from "../../customer/CustomerWebhookListenerLambda";
import { WebhookCustomerFacingOrdersTable } from "../../customer/WebhookCustomerFacingOrdersTable";
import { actionsOf, statements } from "./customerTestSupport";

function synthesize(): Template {
  const stack = new Stack(new App(), "TestStack", { env: { region: "us-east-1" } });
  const ordersTable = new WebhookCustomerFacingOrdersTable(stack, "WebhookCustomerFacingOrdersTable");
  new CustomerWebhookListenerLambda(stack, "CustomerWebhookListenerLambda", { ordersTable });
  return Template.fromStack(stack);
}

describe("CustomerWebhookListenerLambda", () => {
  it("runs the customer package's receiveWebhookController on Node 22", () => {
    synthesize().hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "CustomerWebhookListener-Prod",
      Handler: "index.receiveWebhookController",
      Runtime: "nodejs22.x",
      Timeout: 10,
    });
  });

  it("is given its own table and the name of its own signing secret", () => {
    synthesize().hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: {
          CUSTOMER_ORDERS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^WebhookCustomerFacingOrdersTable") },
          CUSTOMER_SIGNING_SECRET_PARAMETER_NAME: "/customer/prod/webhook/signing-secret",
        },
      },
    });
  });

  it("has a one-month, disposable log group", () => {
    const template = synthesize();
    template.hasResourceProperties("AWS::Logs::LogGroup", { LogGroupName: "/aws/lambda/CustomerWebhookListener-Prod", RetentionInDays: 30 });
    template.hasResource("AWS::Logs::LogGroup", { DeletionPolicy: "Delete" });
  });

  it("may only put rows in its own table and read its own secret", () => {
    const granted = statements(synthesize())
      .flatMap((statement) => actionsOf(statement).map((action) => `${action} ${JSON.stringify(statement.Resource)}`))
      .sort();
    expect(granted).toHaveLength(2);
    expect(granted[0]).toMatch(/^dynamodb:PutItem .*"WebhookCustomerFacingOrdersTable[0-9A-F]{8}","Arn"/);
    expect(granted[1]).toMatch(/^ssm:GetParameter .*:parameter\/customer\/prod\/webhook\/signing-secret"/);
  });
});
