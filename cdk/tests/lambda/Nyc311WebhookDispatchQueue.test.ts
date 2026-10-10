import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { Nyc311OrderEventsTopic } from "../../lambda/Nyc311OrderEventsTopic";
import { Nyc311WebhookDispatchQueue } from "../../lambda/Nyc311WebhookDispatchQueue";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const orderEventsTopic = new Nyc311OrderEventsTopic(stack, "Nyc311OrderEventsTopic", { envName });
  new Nyc311WebhookDispatchQueue(stack, "Nyc311WebhookDispatchQueue", { envName, orderEventsTopic });
  return Template.fromStack(stack);
}

describe("Nyc311WebhookDispatchQueue", () => {
  it("redrives to its own 14-day DLQ after 3 receives", () => {
    const template = synthesize("TEST");
    template.hasResourceProperties("AWS::SQS::Queue", {
      QueueName: "Nyc311WebhookDispatchQueue-Test",
      RedrivePolicy: Match.objectLike({
        deadLetterTargetArn: { "Fn::GetAtt": [Match.stringLikeRegexp("^Nyc311WebhookDispatchQueueDlq"), "Arn"] },
        maxReceiveCount: 3,
      }),
    });
    template.hasResourceProperties("AWS::SQS::Queue", {
      QueueName: "Nyc311WebhookDispatchQueueDlq-Test",
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
    prod.hasResourceProperties("AWS::SQS::Queue", { QueueName: "Nyc311WebhookDispatchQueue-Prod" });
    prod.hasResourceProperties("AWS::SQS::Queue", { QueueName: "Nyc311WebhookDispatchQueueDlq-Prod" });
  });

  it("subscribes to the order events topic with raw delivery, filtered to the public catalogue's source events", () => {
    synthesize("TEST").hasResourceProperties("AWS::SNS::Subscription", {
      Protocol: "sqs",
      RawMessageDelivery: true,
      FilterPolicy: { event_type: ["ORDER_ACCEPTED", "ORDER_RESOLVED"] },
    });
  });
});
