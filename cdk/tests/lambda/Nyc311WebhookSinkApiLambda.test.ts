import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { WebhookSinkDeliveriesTable } from "../../data/WebhookSinkDeliveriesTable";
import { Nyc311WebhookSinkApiLambda, type WebhookSinkApiOperation } from "../../lambda/Nyc311WebhookSinkApiLambda";
import { dynamoActionsOn, ssmGrants } from "./webhookTestSupport";

function synthesize(operation: WebhookSinkApiOperation): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  new Nyc311WebhookSinkApiLambda(stack, "Nyc311WebhookSinkApiLambda", {
    envName: "TEST",
    operation,
    webhookSinkDeliveriesTable: new WebhookSinkDeliveriesTable(stack, "WebhookSinkDeliveriesTable", { envName: "TEST" }),
  });
  return Template.fromStack(stack);
}

describe("Nyc311WebhookSinkApiLambda", () => {
  it("RECEIVE runs the receiver, may only put records, and reads the sink's own secret", () => {
    const template = synthesize("RECEIVE");
    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "Nyc311ReceiveWebhookSinkApi-Test",
      Handler: "index.receiveWebhookSinkController",
      Runtime: "nodejs22.x",
      Environment: {
        Variables: {
          WEBHOOK_SINK_DELIVERIES_TABLE_NAME: { Ref: Match.stringLikeRegexp("^WebhookSinkDeliveriesTable") },
          WEBHOOK_SINK_SECRET_PARAMETER_NAME: "/nyc311/test/webhook-sink/secret",
        },
      },
    });
    expect(dynamoActionsOn(template, "WebhookSinkDeliveriesTable")).toEqual(["dynamodb:PutItem"]);
    expect(ssmGrants(template)).toEqual(["ssm:GetParameter /nyc311/test/webhook-sink/secret"]);
  });

  it("LIST runs the reader, may only scan, and gets no secret access at all", () => {
    const template = synthesize("LIST");
    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "Nyc311GetWebhookSinkDeliveriesApi-Test",
      Handler: "index.getWebhookSinkDeliveriesController",
      Environment: { Variables: { WEBHOOK_SINK_DELIVERIES_TABLE_NAME: { Ref: Match.stringLikeRegexp("^WebhookSinkDeliveriesTable") } } },
    });
    expect(dynamoActionsOn(template, "WebhookSinkDeliveriesTable")).toEqual(["dynamodb:Scan"]);
    expect(ssmGrants(template)).toEqual([]);
  });

  it("gives each operation its own one-month, disposable log group", () => {
    const template = synthesize("LIST");
    template.hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: "/aws/lambda/Nyc311GetWebhookSinkDeliveriesApi-Test",
      RetentionInDays: 30,
    });
    template.hasResource("AWS::Logs::LogGroup", { DeletionPolicy: "Delete" });
  });
});
