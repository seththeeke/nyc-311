import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { OrdersTable } from "../../data/OrdersTable";
import { RequestsTable } from "../../data/RequestsTable";
import { WebhookSubscriptionsTable } from "../../data/WebhookSubscriptionsTable";
import { Nyc311OrderEventsTopic } from "../../lambda/Nyc311OrderEventsTopic";
import { Nyc311WebhookDeliveryQueue } from "../../lambda/Nyc311WebhookDeliveryQueue";
import { Nyc311WebhookDispatchLambda } from "../../lambda/Nyc311WebhookDispatchLambda";
import { Nyc311WebhookDispatchQueue } from "../../lambda/Nyc311WebhookDispatchQueue";
import { dynamoActionsOn, statements } from "./webhookTestSupport";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const orderEventsTopic = new Nyc311OrderEventsTopic(stack, "Nyc311OrderEventsTopic", { envName });
  new Nyc311WebhookDispatchLambda(stack, "Nyc311WebhookDispatchLambda", {
    envName,
    ordersTable: new OrdersTable(stack, "OrdersTable", { envName }),
    requestsTable: new RequestsTable(stack, "RequestsTable", { envName }),
    webhookSubscriptionsTable: new WebhookSubscriptionsTable(stack, "WebhookSubscriptionsTable", { envName }),
    webhookDispatchQueue: new Nyc311WebhookDispatchQueue(stack, "Nyc311WebhookDispatchQueue", { envName, orderEventsTopic }),
    webhookDeliveryQueue: new Nyc311WebhookDeliveryQueue(stack, "Nyc311WebhookDeliveryQueue", { envName }),
  });
  return Template.fromStack(stack);
}

describe("Nyc311WebhookDispatchLambda", () => {
  it("bundles backend/controller/webhook/dispatchWebhookEventController's exported handler on Node 22", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.dispatchWebhookEventController",
      Runtime: "nodejs22.x",
      Timeout: 30,
    });
  });

  it("suffixes the function name and log group by environment", () => {
    const test = synthesize("TEST");
    test.hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311WebhookDispatch-Test" });
    test.hasResourceProperties("AWS::Logs::LogGroup", { LogGroupName: "/aws/lambda/Nyc311WebhookDispatch-Test", RetentionInDays: 30 });
    test.hasResource("AWS::Logs::LogGroup", { DeletionPolicy: "Delete" });
    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311WebhookDispatch-Prod" });
  });

  it("is given the three tables and the delivery queue URL", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: {
          ORDERS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^OrdersTable") },
          REQUESTS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^RequestsTable") },
          WEBHOOK_SUBSCRIPTIONS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^WebhookSubscriptionsTable") },
          WEBHOOK_DELIVERY_QUEUE_URL: { Ref: Match.stringLikeRegexp("^Nyc311WebhookDeliveryQueue[0-9A-F]{8}$") },
        },
      },
    });
  });

  it("consumes the dispatch queue in batches of 10, reporting per-item failures", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::EventSourceMapping", {
      EventSourceArn: { "Fn::GetAtt": [Match.stringLikeRegexp("^Nyc311WebhookDispatchQueue[0-9A-F]{8}$"), "Arn"] },
      BatchSize: 10,
      FunctionResponseTypes: ["ReportBatchItemFailures"],
    });
  });

  it("gets least-privilege table access and may send only to the delivery queue", () => {
    const template = synthesize("TEST");
    expect(dynamoActionsOn(template, "OrdersTable")).toEqual(["dynamodb:GetItem", "dynamodb:Query"]);
    expect(dynamoActionsOn(template, "RequestsTable")).toEqual(["dynamodb:GetItem"]);
    expect(dynamoActionsOn(template, "WebhookSubscriptionsTable")).toEqual(["dynamodb:Scan"]);
    const sendStatements = statements(template).filter((statement) => JSON.stringify(statement.Action).includes("sqs:SendMessage"));
    expect(sendStatements).toHaveLength(1);
    expect(JSON.stringify(sendStatements[0].Resource)).toMatch(/"Nyc311WebhookDeliveryQueue[0-9A-F]{8}"/);
  });
});
