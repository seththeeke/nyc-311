import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { OrdersTable } from "../../data/OrdersTable";
import { Nyc311OrderEventsTopic } from "../../lambda/Nyc311OrderEventsTopic";
import { Nyc311OrderProjectionsTopic } from "../../lambda/Nyc311OrderProjectionsTopic";
import { Nyc311OrdersStreamFanOutLambda } from "../../lambda/Nyc311OrdersStreamFanOutLambda";
import { Nyc311OrderEvaluationQueue } from "../../lambda/Nyc311OrderEvaluationQueue";
import { Nyc311LiveWorkspaceMetricsQueue } from "../../lambda/Nyc311LiveWorkspaceMetricsQueue";
import { Nyc311OrderPipelineAlarms } from "../../lambda/Nyc311OrderPipelineAlarms";

const FAILURE_EMAIL = "seththeeke@gmail.com";

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const ordersTable = new OrdersTable(stack, "OrdersTable", { envName });
  const orderEventsTopic = new Nyc311OrderEventsTopic(stack, "Nyc311OrderEventsTopic", { envName });
  const orderProjectionsTopic = new Nyc311OrderProjectionsTopic(stack, "Nyc311OrderProjectionsTopic", { envName });
  const ordersStreamFanOutLambda = new Nyc311OrdersStreamFanOutLambda(stack, "Nyc311OrdersStreamFanOutLambda", {
    envName,
    ordersTable,
    orderEventsTopic,
    orderProjectionsTopic,
  });
  const orderEvaluationQueue = new Nyc311OrderEvaluationQueue(stack, "Nyc311OrderEvaluationQueue", {
    envName,
    orderEventsTopic,
  });
  const liveWorkspaceMetricsQueue = new Nyc311LiveWorkspaceMetricsQueue(stack, "Nyc311LiveWorkspaceMetricsQueue", {
    envName,
    orderEventsTopic,
  });
  new Nyc311OrderPipelineAlarms(stack, "Nyc311OrderPipelineAlarms", {
    envName,
    ordersStreamFanOutLambda,
    orderEvaluationQueue,
    liveWorkspaceMetricsQueue,
    failureNotificationEmail: FAILURE_EMAIL,
  });
  return Template.fromStack(stack);
}

describe("Nyc311OrderPipelineAlarms", () => {
  it("creates an errors alarm on the fan-out Lambda, 3 consecutive periods", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "Nyc311OrdersStreamFanOutErrorsAlarm-Test",
      MetricName: "Errors",
      EvaluationPeriods: 3,
      Threshold: 1,
    });
  });

  it("creates an IteratorAge alarm on the fan-out Lambda", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "Nyc311OrdersStreamFanOutIteratorAgeAlarm-Test",
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

  it("creates a DLQ-depth alarm on the live workspace metrics queue's DLQ, alarming on a single occurrence", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "Nyc311LiveWorkspaceMetricsDlqDepthAlarm-Test",
      MetricName: "ApproximateNumberOfMessagesVisible",
      Dimensions: [{ Name: "QueueName", Value: { "Fn::GetAtt": [Match.stringLikeRegexp("^Nyc311LiveWorkspaceMetricsQueueDlq"), "QueueName"] } }],
      EvaluationPeriods: 1,
      Threshold: 1,
    });
    synthesize("PROD").hasResourceProperties("AWS::CloudWatch::Alarm", { AlarmName: "Nyc311LiveWorkspaceMetricsDlqDepthAlarm-Prod" });
  });

  it("routes every alarm to one shared, email-subscribed SNS topic", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::SNS::Topic", { TopicName: "Nyc311OrderPipelineFailures-Test" });
    template.hasResourceProperties("AWS::SNS::Subscription", {
      Protocol: "email",
      Endpoint: FAILURE_EMAIL,
    });
    const alarms = template.findResources("AWS::CloudWatch::Alarm");
    expect(Object.keys(alarms)).toHaveLength(4);
    for (const alarm of Object.values(alarms)) {
      expect((alarm.Properties as { AlarmActions: unknown[] }).AlarmActions).toHaveLength(1);
    }
  });

  it("suffixes alarm/topic names by environment, distinguishing Test from Prod", () => {
    synthesize("PROD").hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "Nyc311OrdersStreamFanOutErrorsAlarm-Prod",
    });
    synthesize("PROD").hasResourceProperties("AWS::SNS::Topic", { TopicName: "Nyc311OrderPipelineFailures-Prod" });
  });
});
