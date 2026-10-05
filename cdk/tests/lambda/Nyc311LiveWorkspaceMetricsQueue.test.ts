import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { Nyc311OrderEventsTopic } from "../../lambda/Nyc311OrderEventsTopic";
import { Nyc311LiveWorkspaceMetricsQueue } from "../../lambda/Nyc311LiveWorkspaceMetricsQueue";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const orderEventsTopic = new Nyc311OrderEventsTopic(stack, "Nyc311OrderEventsTopic", { envName });
  new Nyc311LiveWorkspaceMetricsQueue(stack, "Nyc311LiveWorkspaceMetricsQueue", { envName, orderEventsTopic });
  return Template.fromStack(stack);
}

describe("Nyc311LiveWorkspaceMetricsQueue", () => {
  it("redrives to its own 14-day DLQ after 3 receives", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::SQS::Queue", {
      QueueName: "Nyc311LiveWorkspaceMetricsQueue-Test",
      RedrivePolicy: Match.objectLike({
        deadLetterTargetArn: {
          "Fn::GetAtt": [Match.stringLikeRegexp("^Nyc311LiveWorkspaceMetricsQueueDlq"), "Arn"],
        },
        maxReceiveCount: 3,
      }),
    });
    template.hasResourceProperties("AWS::SQS::Queue", {
      QueueName: "Nyc311LiveWorkspaceMetricsQueueDlq-Test",
      MessageRetentionPeriod: 14 * 24 * 60 * 60,
    });
  });

  it("enforces SSL via a queue policy", () => {
    synthesize("TEST").hasResourceProperties("AWS::SQS::QueuePolicy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({ Effect: "Deny", Condition: { Bool: { "aws:SecureTransport": "false" } } }),
        ]),
      }),
    });
  });

  it("suffixes the queue and DLQ physical names by environment", () => {
    synthesize("PROD").hasResourceProperties("AWS::SQS::Queue", { QueueName: "Nyc311LiveWorkspaceMetricsQueue-Prod" });
    synthesize("PROD").hasResourceProperties("AWS::SQS::Queue", { QueueName: "Nyc311LiveWorkspaceMetricsQueueDlq-Prod" });
  });

  it("subscribes to the order events topic with raw delivery, filtered to ORDER_ACCEPTED and ORDER_RESOLVED only", () => {
    synthesize("TEST").hasResourceProperties("AWS::SNS::Subscription", {
      Protocol: "sqs",
      RawMessageDelivery: true,
      FilterPolicy: { event_type: ["ORDER_ACCEPTED", "ORDER_RESOLVED"] },
    });
  });
});
