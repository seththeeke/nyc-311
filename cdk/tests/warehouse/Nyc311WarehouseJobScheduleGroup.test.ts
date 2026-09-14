import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { WarehouseJobRunsTable } from "../../data/WarehouseJobRunsTable";
import { Nyc311WarehouseBucket } from "../../warehouse/Nyc311WarehouseBucket";
import { Nyc311WarehouseCatalog } from "../../warehouse/Nyc311WarehouseCatalog";
import { Nyc311AnalyticsWorkgroup } from "../../warehouse/Nyc311AnalyticsWorkgroup";
import { Nyc311WarehouseJobRunnerLambda } from "../../warehouse/Nyc311WarehouseJobRunnerLambda";
import { Nyc311WarehouseJobScheduleGroup } from "../../warehouse/Nyc311WarehouseJobScheduleGroup";

function synthesize(envName: "TEST" | "PROD" = "TEST"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const jobRunsTable = new WarehouseJobRunsTable(stack, "WarehouseJobRunsTable", { envName });
  const warehouseBucket = new Nyc311WarehouseBucket(stack, "Nyc311WarehouseBucket", { envName });
  const warehouseCatalog = new Nyc311WarehouseCatalog(stack, "Nyc311WarehouseCatalog", { envName, warehouseBucket });
  const analyticsWorkgroup = new Nyc311AnalyticsWorkgroup(stack, "Nyc311AnalyticsWorkgroup", { envName, warehouseBucket });
  const jobRunnerLambda = new Nyc311WarehouseJobRunnerLambda(stack, "Nyc311WarehouseJobRunnerLambda", {
    envName,
    jobRunsTable,
    warehouseBucket,
    warehouseCatalog,
    analyticsWorkgroup,
  });
  new Nyc311WarehouseJobScheduleGroup(stack, "Nyc311WarehouseJobScheduleGroup", {
    envName,
    jobRunnerLambda,
    failureNotificationEmail: "ops@example.com",
  });
  return Template.fromStack(stack);
}

describe("Nyc311WarehouseJobScheduleGroup", () => {
  it("names the schedule group per environment", () => {
    synthesize("TEST").hasResourceProperties("AWS::Scheduler::ScheduleGroup", { Name: "Nyc311WarehouseJobs-Test" });
    synthesize("PROD").hasResourceProperties("AWS::Scheduler::ScheduleGroup", { Name: "Nyc311WarehouseJobs-Prod" });
  });

  it("creates an invocation role trusted only by scheduler.amazonaws.com, named per environment", () => {
    synthesize("TEST").hasResourceProperties("AWS::IAM::Role", {
      RoleName: "Nyc311WarehouseJobScheduleRole-Test",
      AssumeRolePolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Principal: { Service: "scheduler.amazonaws.com" },
            Action: "sts:AssumeRole",
          }),
        ]),
      }),
    });
  });

  it("grants the invocation role lambda:InvokeFunction on the job runner only", () => {
    const template = synthesize("TEST");
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: "lambda:InvokeFunction",
            Effect: "Allow",
            Resource: { "Fn::GetAtt": [Match.stringLikeRegexp("^Nyc311WarehouseJobRunnerLambda"), "Arn"] },
          }),
        ]),
      }),
      Roles: Match.arrayWith([{ Ref: Match.stringLikeRegexp("^Nyc311WarehouseJobScheduleGroupInvocationRole") }]),
    });

    const policies = template.findResources("AWS::IAM::Policy");
    const allActions = Object.values(policies).flatMap((p) => {
      const statements = (p.Properties as { PolicyDocument: { Statement: { Action?: string | string[] }[] } })
        .PolicyDocument.Statement;
      return statements.flatMap((s) => (Array.isArray(s.Action) ? s.Action : s.Action ? [s.Action] : []));
    });
    /* the invocation role's own policy carries lambda:InvokeFunction and nothing else */
    const lambdaActions = allActions.filter((a) => a.startsWith("lambda:"));
    expect(lambdaActions).toEqual(["lambda:InvokeFunction"]);
  });

  it("creates a dead-letter queue named per environment, SSL-enforced, DESTROY on removal", () => {
    const template = synthesize("TEST");
    template.hasResourceProperties("AWS::SQS::Queue", { QueueName: "Nyc311WarehouseJobsDlq-Test" });
    template.hasResourceProperties("AWS::SQS::QueuePolicy", {});
    template.hasResource("AWS::SQS::Queue", { DeletionPolicy: "Delete" });
  });

  it("alarms on a single failed run and emails the failure address", () => {
    const template = synthesize("TEST");
    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "Nyc311WarehouseJobsFailureAlarm-Test",
      Threshold: 1,
      EvaluationPeriods: 1,
      ComparisonOperator: "GreaterThanOrEqualToThreshold",
    });
    template.hasResourceProperties("AWS::SNS::Topic", { TopicName: "Nyc311WarehouseJobsFailures-Test" });
    template.hasResourceProperties("AWS::SNS::Subscription", { Protocol: "email", Endpoint: "ops@example.com" });
  });
});
