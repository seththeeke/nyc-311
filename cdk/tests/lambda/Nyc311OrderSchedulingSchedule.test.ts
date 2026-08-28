import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { OrdersTable } from "../../data/OrdersTable";
import { RequestsTable } from "../../data/RequestsTable";
import { LocationsTable } from "../../data/LocationsTable";
import { Nyc311OrderSchedulingLambda } from "../../lambda/Nyc311OrderSchedulingLambda";
import { Nyc311OrderSchedulingSchedule } from "../../lambda/Nyc311OrderSchedulingSchedule";

function synthesize(envName: "TEST" | "PROD" = "TEST"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const ordersTable = new OrdersTable(stack, "OrdersTable", { envName });
  const requestsTable = new RequestsTable(stack, "RequestsTable", { envName });
  const locationsTable = new LocationsTable(stack, "LocationsTable", { envName });
  const orderSchedulingLambda = new Nyc311OrderSchedulingLambda(stack, "Nyc311OrderSchedulingLambda", {
    envName,
    ordersTable,
    requestsTable,
    locationsTable,
  });
  new Nyc311OrderSchedulingSchedule(stack, "Nyc311OrderSchedulingSchedule", {
    envName,
    orderSchedulingLambda,
    failureNotificationEmail: "seththeeke@gmail.com",
  });
  return Template.fromStack(stack);
}

describe("Nyc311OrderSchedulingSchedule", () => {
  it("invokes the order-scheduling Lambda every hour, per the user's stated cadence (6-order-scheduling.md §1)", () => {
    const template = synthesize();

    template.hasResourceProperties("AWS::Scheduler::Schedule", {
      ScheduleExpression: "rate(1 hour)",
      Target: Match.objectLike({
        Arn: { "Fn::GetAtt": [Match.stringLikeRegexp("^Nyc311OrderSchedulingLambda"), "Arn"] },
      }),
    });
  });

  it("routes failed invocations (after Scheduler's own retries) to a dead-letter SQS queue", () => {
    const template = synthesize();

    template.hasResourceProperties("AWS::Scheduler::Schedule", {
      Target: Match.objectLike({
        DeadLetterConfig: Match.objectLike({
          Arn: { "Fn::GetAtt": [Match.stringLikeRegexp("^Nyc311OrderSchedulingScheduleDlq"), "Arn"] },
        }),
      }),
    });
  });

  it("alarms on 3 consecutive 1-hour periods of Lambda Errors and emails the failure address", () => {
    const template = synthesize();

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      Namespace: "AWS/Lambda",
      MetricName: "Errors",
      Statistic: "Sum",
      Period: 3600,
      EvaluationPeriods: 3,
      Threshold: 1,
      ComparisonOperator: "GreaterThanOrEqualToThreshold",
      TreatMissingData: "notBreaching",
    });
    template.hasResourceProperties("AWS::SNS::Subscription", {
      Protocol: "email",
      Endpoint: "seththeeke@gmail.com",
    });
  });

  it("suffixes the DLQ/schedule/topic/alarm physical names by environment, distinguishing Test from Prod", () => {
    const testTemplate = synthesize("TEST");
    testTemplate.hasResourceProperties("AWS::SQS::Queue", { QueueName: "Nyc311OrderSchedulingDlq-Test" });
    testTemplate.hasResourceProperties("AWS::Scheduler::Schedule", { Name: "Nyc311OrderSchedulingSchedule-Test" });
    testTemplate.hasResourceProperties("AWS::SNS::Topic", { TopicName: "Nyc311OrderSchedulingFailures-Test" });
    testTemplate.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "Nyc311OrderSchedulingFailureAlarm-Test",
    });

    const prodTemplate = synthesize("PROD");
    prodTemplate.hasResourceProperties("AWS::SQS::Queue", { QueueName: "Nyc311OrderSchedulingDlq-Prod" });
    prodTemplate.hasResourceProperties("AWS::Scheduler::Schedule", { Name: "Nyc311OrderSchedulingSchedule-Prod" });
    prodTemplate.hasResourceProperties("AWS::SNS::Topic", { TopicName: "Nyc311OrderSchedulingFailures-Prod" });
    prodTemplate.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "Nyc311OrderSchedulingFailureAlarm-Prod",
    });
  });
});
