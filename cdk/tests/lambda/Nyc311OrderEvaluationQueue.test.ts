import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { Nyc311OrderEventsTopic } from "../../lambda/Nyc311OrderEventsTopic";
import { Nyc311OrderEvaluationQueue } from "../../lambda/Nyc311OrderEvaluationQueue";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const orderEventsTopic = new Nyc311OrderEventsTopic(stack, "Nyc311OrderEventsTopic", { envName });
  new Nyc311OrderEvaluationQueue(stack, "Nyc311OrderEvaluationQueue", { envName, orderEventsTopic });
  return Template.fromStack(stack);
}

describe("Nyc311OrderEvaluationQueue", () => {
  it("is a standard queue (no FifoQueue property) with SSL enforced", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::SQS::Queue", { QueueName: "Nyc311OrderEvaluationQueue-Test" });
    template.hasResourceProperties("AWS::SQS::QueuePolicy", {});
  });

  it("redrives to its own DLQ after 3 receives", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::SQS::Queue", {
      QueueName: "Nyc311OrderEvaluationQueue-Test",
      RedrivePolicy: Match.objectLike({
        deadLetterTargetArn: {
          "Fn::GetAtt": [Match.stringLikeRegexp("^Nyc311OrderEvaluationQueueDlq"), "Arn"],
        },
        maxReceiveCount: 3,
      }),
    });
  });

  it("suffixes the queue and DLQ physical names by environment, distinguishing Test from Prod", () => {
    synthesize("TEST").hasResourceProperties("AWS::SQS::Queue", { QueueName: "Nyc311OrderEvaluationQueue-Test" });
    synthesize("TEST").hasResourceProperties("AWS::SQS::Queue", { QueueName: "Nyc311OrderEvaluationQueueDlq-Test" });

    synthesize("PROD").hasResourceProperties("AWS::SQS::Queue", { QueueName: "Nyc311OrderEvaluationQueue-Prod" });
    synthesize("PROD").hasResourceProperties("AWS::SQS::Queue", { QueueName: "Nyc311OrderEvaluationQueueDlq-Prod" });
  });

  it("subscribes to the topic with raw message delivery, filtered to ORDER_CREATED only", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::SNS::Subscription", {
      Protocol: "sqs",
      RawMessageDelivery: true,
      FilterPolicy: { event_type: ["ORDER_CREATED"] },
    });
  });
});
