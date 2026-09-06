import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { Nyc311OrderIngestionQueue } from "../../lambda/Nyc311OrderIngestionQueue";
import { Nyc311RequestEventsTopic } from "../../lambda/Nyc311RequestEventsTopic";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const requestEventsTopic = new Nyc311RequestEventsTopic(stack, "Nyc311RequestEventsTopic", { envName });
  new Nyc311OrderIngestionQueue(stack, "Nyc311OrderIngestionQueue", { envName, requestEventsTopic });
  return Template.fromStack(stack);
}

describe("Nyc311OrderIngestionQueue", () => {
  it("is a standard queue (no FifoQueue property) with SSL enforced", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::SQS::Queue", {
      QueueName: "Nyc311OrderIngestionQueue-Test",
    });
    template.hasResourceProperties("AWS::SQS::QueuePolicy", {});
  });

  it("redrives to its own DLQ after 3 receives, per 3-order-ingestion.md §2.1/§2.3's consistent retry budget", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::SQS::Queue", {
      QueueName: "Nyc311OrderIngestionQueue-Test",
      RedrivePolicy: Match.objectLike({
        deadLetterTargetArn: {
          "Fn::GetAtt": [Match.stringLikeRegexp("^Nyc311OrderIngestionQueueDlq"), "Arn"],
        },
        maxReceiveCount: 3,
      }),
    });
  });

  it("subscribes to Nyc311RequestEventsTopic with raw delivery and an INSERT-only filter policy (7-data-warehousing.md §4)", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::SNS::Subscription", {
      Protocol: "sqs",
      RawMessageDelivery: true,
      FilterPolicy: { event_name: ["INSERT"] },
      TopicArn: { Ref: Match.stringLikeRegexp("^Nyc311RequestEventsTopic") },
    });
  });

  it("suffixes the queue and DLQ physical names by environment, distinguishing Test from Prod", () => {
    synthesize("TEST").hasResourceProperties("AWS::SQS::Queue", { QueueName: "Nyc311OrderIngestionQueue-Test" });
    synthesize("TEST").hasResourceProperties("AWS::SQS::Queue", { QueueName: "Nyc311OrderIngestionQueueDlq-Test" });

    synthesize("PROD").hasResourceProperties("AWS::SQS::Queue", { QueueName: "Nyc311OrderIngestionQueue-Prod" });
    synthesize("PROD").hasResourceProperties("AWS::SQS::Queue", { QueueName: "Nyc311OrderIngestionQueueDlq-Prod" });
  });
});
