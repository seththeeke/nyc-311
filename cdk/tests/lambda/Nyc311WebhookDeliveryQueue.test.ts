import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { Nyc311WebhookDeliveryQueue } from "../../lambda/Nyc311WebhookDeliveryQueue";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  new Nyc311WebhookDeliveryQueue(stack, "Nyc311WebhookDeliveryQueue", { envName });
  return Template.fromStack(stack);
}

describe("Nyc311WebhookDeliveryQueue", () => {
  it("retries every 30 minutes, 48 times, then dead-letters — the whole retry policy", () => {
    const template = synthesize("TEST");
    template.hasResourceProperties("AWS::SQS::Queue", {
      QueueName: "Nyc311WebhookDeliveryQueue-Test",
      VisibilityTimeout: 30 * 60,
      RedrivePolicy: Match.objectLike({
        deadLetterTargetArn: { "Fn::GetAtt": [Match.stringLikeRegexp("^Nyc311WebhookDeliveryQueueDlq"), "Arn"] },
        maxReceiveCount: 48,
      }),
    });
    template.hasResourceProperties("AWS::SQS::Queue", {
      QueueName: "Nyc311WebhookDeliveryQueueDlq-Test",
      MessageRetentionPeriod: 14 * 24 * 60 * 60,
    });
  });

  it("enforces SSL and suffixes names by environment", () => {
    synthesize("TEST").hasResourceProperties("AWS::SQS::QueuePolicy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([Match.objectLike({ Effect: "Deny", Condition: { Bool: { "aws:SecureTransport": "false" } } })]),
      }),
    });
    const prod = synthesize("PROD");
    prod.hasResourceProperties("AWS::SQS::Queue", { QueueName: "Nyc311WebhookDeliveryQueue-Prod" });
    prod.hasResourceProperties("AWS::SQS::Queue", { QueueName: "Nyc311WebhookDeliveryQueueDlq-Prod" });
  });
});
