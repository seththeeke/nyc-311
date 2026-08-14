import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { RequestsTable } from "../../data/RequestsTable";
import { Nyc311PollerLambda } from "../../lambda/Nyc311PollerLambda";
import { Nyc311PollerSchedule } from "../../lambda/Nyc311PollerSchedule";

function synthesize(envName: "TEST" | "PROD" = "TEST"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const requestsTable = new RequestsTable(stack, "RequestsTable", { envName });
  const pollerLambda = new Nyc311PollerLambda(stack, "Nyc311PollerLambda", { envName, requestsTable });
  new Nyc311PollerSchedule(stack, "Nyc311PollerSchedule", {
    envName,
    pollerLambda,
    failureNotificationEmail: "seththeeke@gmail.com",
  });
  return Template.fromStack(stack);
}

describe("Nyc311PollerSchedule", () => {
  it("invokes the poller Lambda every 6 hours, per 1-data-ingestion.md's cadence decision", () => {
    const template = synthesize();

    template.hasResourceProperties("AWS::Scheduler::Schedule", {
      ScheduleExpression: "rate(6 hours)",
      Target: Match.objectLike({
        Arn: { "Fn::GetAtt": [Match.stringLikeRegexp("^Nyc311PollerLambda"), "Arn"] },
      }),
    });
  });

  it("routes failed invocations (after Scheduler's own retries) to a dead-letter SQS queue", () => {
    const template = synthesize();

    template.hasResourceProperties("AWS::Scheduler::Schedule", {
      Target: Match.objectLike({
        DeadLetterConfig: Match.objectLike({
          Arn: { "Fn::GetAtt": [Match.stringLikeRegexp("^Nyc311PollerScheduleDlq"), "Arn"] },
        }),
      }),
    });
  });

  it("alarms on 3 consecutive 6-hour periods of Lambda Errors and emails the failure address", () => {
    const template = synthesize();

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      Namespace: "AWS/Lambda",
      MetricName: "Errors",
      Statistic: "Sum",
      Period: 21600,
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
    testTemplate.hasResourceProperties("AWS::SQS::Queue", { QueueName: "Nyc311PollerDlq-Test" });
    testTemplate.hasResourceProperties("AWS::Scheduler::Schedule", { Name: "Nyc311PollerSchedule-Test" });
    testTemplate.hasResourceProperties("AWS::SNS::Topic", { TopicName: "Nyc311PollerFailures-Test" });
    testTemplate.hasResourceProperties("AWS::CloudWatch::Alarm", { AlarmName: "Nyc311PollerFailureAlarm-Test" });

    const prodTemplate = synthesize("PROD");
    prodTemplate.hasResourceProperties("AWS::SQS::Queue", { QueueName: "Nyc311PollerDlq-Prod" });
    prodTemplate.hasResourceProperties("AWS::Scheduler::Schedule", { Name: "Nyc311PollerSchedule-Prod" });
    prodTemplate.hasResourceProperties("AWS::SNS::Topic", { TopicName: "Nyc311PollerFailures-Prod" });
    prodTemplate.hasResourceProperties("AWS::CloudWatch::Alarm", { AlarmName: "Nyc311PollerFailureAlarm-Prod" });
  });
});
