import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { OrdersTable } from "../../data/OrdersTable";
import { Nyc311OrderEventsTopic } from "../../lambda/Nyc311OrderEventsTopic";
import { Nyc311OrderEventFanOutLambda } from "../../lambda/Nyc311OrderEventFanOutLambda";
import { Nyc311OrderEvaluationQueue } from "../../lambda/Nyc311OrderEvaluationQueue";
import { Nyc311OrderPipelineAlarms } from "../../lambda/Nyc311OrderPipelineAlarms";

const FAILURE_EMAIL = "seththeeke@gmail.com";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const ordersTable = new OrdersTable(stack, "OrdersTable", { envName });
  const orderEventsTopic = new Nyc311OrderEventsTopic(stack, "Nyc311OrderEventsTopic", { envName });
  const orderEventFanOutLambda = new Nyc311OrderEventFanOutLambda(stack, "Nyc311OrderEventFanOutLambda", {
    envName,
    ordersTable,
    orderEventsTopic,
  });
  const orderEvaluationQueue = new Nyc311OrderEvaluationQueue(stack, "Nyc311OrderEvaluationQueue", {
    envName,
    orderEventsTopic,
  });
  new Nyc311OrderPipelineAlarms(stack, "Nyc311OrderPipelineAlarms", {
    envName,
    orderEventFanOutLambda,
    orderEvaluationQueue,
    failureNotificationEmail: FAILURE_EMAIL,
  });
  return Template.fromStack(stack);
}

describe("Nyc311OrderPipelineAlarms", () => {
  it("creates an errors alarm on the fan-out Lambda, 3 consecutive periods", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "Nyc311OrderEventFanOutErrorsAlarm-Test",
      MetricName: "Errors",
      EvaluationPeriods: 3,
      Threshold: 1,
    });
  });

  it("creates an IteratorAge alarm on the fan-out Lambda", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "Nyc311OrderEventFanOutIteratorAgeAlarm-Test",
      Namespace: "AWS/Lambda",
      MetricName: "IteratorAge",
    });
  });

  it("creates a DLQ-depth alarm on the evaluation queue's DLQ, alarming on a single occurrence", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "Nyc311OrderEvaluationDlqDepthAlarm-Test",
      MetricName: "ApproximateNumberOfMessagesVisible",
      EvaluationPeriods: 1,
      Threshold: 1,
    });
  });

  it("routes every alarm to one shared, email-subscribed SNS topic", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::SNS::Topic", { TopicName: "Nyc311OrderPipelineFailures-Test" });
    template.hasResourceProperties("AWS::SNS::Subscription", {
      Protocol: "email",
      Endpoint: FAILURE_EMAIL,
    });
    const alarms = template.findResources("AWS::CloudWatch::Alarm");
    expect(Object.keys(alarms)).toHaveLength(3);
    for (const alarm of Object.values(alarms)) {
      expect((alarm.Properties as { AlarmActions: unknown[] }).AlarmActions).toHaveLength(1);
    }
  });

  it("suffixes alarm/topic names by environment, distinguishing Test from Prod", () => {
    synthesize("PROD").hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "Nyc311OrderEventFanOutErrorsAlarm-Prod",
    });
    synthesize("PROD").hasResourceProperties("AWS::SNS::Topic", { TopicName: "Nyc311OrderPipelineFailures-Prod" });
  });
});
