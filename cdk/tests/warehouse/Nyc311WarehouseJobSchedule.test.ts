import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { WarehouseJobRunsTable } from "../../data/WarehouseJobRunsTable";
import { AnalyticsRollupsTable } from "../../data/AnalyticsRollupsTable";
import { Nyc311WarehouseBucket } from "../../warehouse/Nyc311WarehouseBucket";
import { Nyc311WarehouseCatalog } from "../../warehouse/Nyc311WarehouseCatalog";
import { Nyc311AnalyticsWorkgroup } from "../../warehouse/Nyc311AnalyticsWorkgroup";
import { Nyc311WarehouseJobRunnerLambda } from "../../warehouse/Nyc311WarehouseJobRunnerLambda";
import { Nyc311WarehouseJobSchedule } from "../../warehouse/Nyc311WarehouseJobSchedule";

function synthesize(envName: "TEST" | "PROD" = "TEST"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const jobRunsTable = new WarehouseJobRunsTable(stack, "WarehouseJobRunsTable", { envName });
  const rollupsTable = new AnalyticsRollupsTable(stack, "AnalyticsRollupsTable", { envName });
  const warehouseBucket = new Nyc311WarehouseBucket(stack, "Nyc311WarehouseBucket", { envName });
  const warehouseCatalog = new Nyc311WarehouseCatalog(stack, "Nyc311WarehouseCatalog", { envName, warehouseBucket });
  const analyticsWorkgroup = new Nyc311AnalyticsWorkgroup(stack, "Nyc311AnalyticsWorkgroup", { envName, warehouseBucket });
  const jobRunnerLambda = new Nyc311WarehouseJobRunnerLambda(stack, "Nyc311WarehouseJobRunnerLambda", {
    envName,
    jobRunsTable,
    rollupsTable,
    warehouseBucket,
    warehouseCatalog,
    analyticsWorkgroup,
  });
  new Nyc311WarehouseJobSchedule(stack, "Nyc311WarehouseJobSchedule", {
    envName,
    jobRunnerLambda,
    failureNotificationEmail: "seththeeke@gmail.com",
  });
  return Template.fromStack(stack);
}

describe("Nyc311WarehouseJobSchedule", () => {
  it("invokes the job runner Lambda once a day (7-data-warehousing.md §8)", () => {
    synthesize().hasResourceProperties("AWS::Scheduler::Schedule", {
      ScheduleExpression: "rate(1 day)",
      Target: Match.objectLike({
        Arn: { "Fn::GetAtt": [Match.stringLikeRegexp("^Nyc311WarehouseJobRunnerLambda"), "Arn"] },
      }),
    });
  });

  it("routes failed invocations to a dead-letter SQS queue", () => {
    synthesize().hasResourceProperties("AWS::Scheduler::Schedule", {
      Target: Match.objectLike({
        DeadLetterConfig: Match.objectLike({
          Arn: { "Fn::GetAtt": [Match.stringLikeRegexp("^Nyc311WarehouseJobScheduleDlq"), "Arn"] },
        }),
      }),
    });
  });

  it("alarms on a single failed daily run and emails the failure address", () => {
    const template = synthesize();

    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      Namespace: "AWS/Lambda",
      MetricName: "Errors",
      Statistic: "Sum",
      Period: 86400,
      EvaluationPeriods: 1,
      Threshold: 1,
      ComparisonOperator: "GreaterThanOrEqualToThreshold",
      TreatMissingData: "notBreaching",
    });
    template.hasResourceProperties("AWS::SNS::Subscription", { Protocol: "email", Endpoint: "seththeeke@gmail.com" });
  });

  it("suffixes the DLQ/schedule/topic/alarm physical names by environment", () => {
    const test = synthesize("TEST");
    test.hasResourceProperties("AWS::SQS::Queue", { QueueName: "Nyc311WarehouseJobDlq-Test" });
    test.hasResourceProperties("AWS::Scheduler::Schedule", { Name: "Nyc311WarehouseJobSchedule-Test" });
    test.hasResourceProperties("AWS::SNS::Topic", { TopicName: "Nyc311WarehouseJobFailures-Test" });
    test.hasResourceProperties("AWS::CloudWatch::Alarm", { AlarmName: "Nyc311WarehouseJobFailureAlarm-Test" });

    synthesize("PROD").hasResourceProperties("AWS::Scheduler::Schedule", { Name: "Nyc311WarehouseJobSchedule-Prod" });
  });
});
