import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { WebhookSubscriptionsTable } from "../../data/WebhookSubscriptionsTable";
import { Nyc311WebhookDeliveryLambda } from "../../lambda/Nyc311WebhookDeliveryLambda";
import { Nyc311WebhookDeliveryQueue } from "../../lambda/Nyc311WebhookDeliveryQueue";
import { dynamoActionsOn, ssmGrants } from "./webhookTestSupport";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  new Nyc311WebhookDeliveryLambda(stack, "Nyc311WebhookDeliveryLambda", {
    envName,
    webhookSubscriptionsTable: new WebhookSubscriptionsTable(stack, "WebhookSubscriptionsTable", { envName }),
    webhookDeliveryQueue: new Nyc311WebhookDeliveryQueue(stack, "Nyc311WebhookDeliveryQueue", { envName }),
  });
  return Template.fromStack(stack);
}

describe("Nyc311WebhookDeliveryLambda", () => {
  it("bundles backend/controller/webhook/deliverWebhookController's exported handler on Node 22", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.deliverWebhookController",
      Runtime: "nodejs22.x",
      Timeout: 20,
      Environment: { Variables: { WEBHOOK_SUBSCRIPTIONS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^WebhookSubscriptionsTable") } } },
    });
  });

  it("suffixes the function name and log group by environment", () => {
    const test = synthesize("TEST");
    test.hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311WebhookDelivery-Test" });
    test.hasResourceProperties("AWS::Logs::LogGroup", { LogGroupName: "/aws/lambda/Nyc311WebhookDelivery-Test", RetentionInDays: 30 });
    test.hasResource("AWS::Logs::LogGroup", { DeletionPolicy: "Delete" });
    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311WebhookDelivery-Prod" });
  });

  it("takes one message at a time with at most 2 in flight, reporting per-item failures", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::EventSourceMapping", {
      EventSourceArn: { "Fn::GetAtt": [Match.stringLikeRegexp("^Nyc311WebhookDeliveryQueue[0-9A-F]{8}$"), "Arn"] },
      BatchSize: 1,
      ScalingConfig: { MaximumConcurrency: 2 },
      FunctionResponseTypes: ["ReportBatchItemFailures"],
    });
  });

  it("may read one subscription and subscription secrets — not write them, and not the registration key", () => {
    const test = synthesize("TEST");
    expect(dynamoActionsOn(test, "WebhookSubscriptionsTable")).toEqual(["dynamodb:GetItem"]);
    expect(ssmGrants(test)).toEqual(["ssm:GetParameter /nyc311/test/webhook/*/secret"]);
    expect(ssmGrants(synthesize("PROD"))).toEqual(["ssm:GetParameter /nyc311/prod/webhook/*/secret"]);
  });
});
