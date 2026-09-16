import { App, CfnOutput } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { beforeAll, describe, expect, it } from "vitest";
import { Nyc311Stack } from "../../stack/Nyc311Stack";

function synthesize(id: string, envName: "TEST" | "PROD") {
  const app = new App();
  const stack = new Nyc311Stack(app, id, { envName, env: { region: "us-east-1" } });
  return { stack, template: Template.fromStack(stack) };
}

/*
 * Synthesizing the full stack is ~4s of synchronous CPU work on CodeBuild;
 * doing it once per `it` (19 times) blocked the Vitest worker's event loop
 * long enough to blow the fixed 60s worker↔main RPC timeout ("Timeout
 * calling onTaskUpdate"), failing the Synth build even though every
 * assertion passed. Synthesize each environment exactly once here and
 * share the read-only Template/stack across every assertion below.
 */
let testEnv: ReturnType<typeof synthesize>;
let prodEnv: ReturnType<typeof synthesize>;

beforeAll(() => {
  testEnv = synthesize("TestStack", "TEST");
  prodEnv = synthesize("ProdStack", "PROD");
});

describe("Nyc311Stack", () => {
  it("synthesizes and tags the stack for TEST", () => {
    const { stack, template } = testEnv;

    /*
     * Tags.of(...).add(...) applies via an Aspect, only visited during
     * synthesis — Template.fromStack (in beforeAll) triggers it before
     * stack.tags is read here.
     */
    expect(template.toJSON()).toBeDefined();
    expect(stack.tags.tagValues()).toMatchObject({ Environment: "TEST" });
  });

  it("synthesizes and tags the stack for PROD", () => {
    const { stack, template } = prodEnv;

    expect(template.toJSON()).toBeDefined();
    expect(stack.tags.tagValues()).toMatchObject({ Environment: "PROD" });
  });

  it("exposes apiUrlOutput as the same Nyc311ApiUrl CfnOutput the template declares (4-pipeline-integration-tests.md §5)", () => {
    const { stack, template } = testEnv;

    expect(stack.apiUrlOutput).toBeInstanceOf(CfnOutput);
    template.hasOutput("Nyc311ApiUrl", {});
  });

  it("exposes adminUserPoolClientIdOutput and Nyc311AdminUserPoolId, both CfnOutputs (9-admin-auth-integration.md §8)", () => {
    const { stack, template } = testEnv;

    expect(stack.adminUserPoolClientIdOutput).toBeInstanceOf(CfnOutput);
    template.hasOutput("Nyc311AdminUserPoolClientId", {});
    template.hasOutput("Nyc311AdminUserPoolId", {});
  });

  it("wires the Requests table, poller Lambda, and its schedule together (first ingestion slice)", () => {
    const { template } = testEnv;

    template.hasResourceProperties("AWS::DynamoDB::GlobalTable", { TableName: "Requests-Test" });
    /*
     * Not resourceCountIs(1) here — WebsiteHosting's BucketDeployment and
     * autoDeleteObjects each wire their own custom-resource Lambda, so the
     * poller is one of several AWS::Lambda::Function resources in this
     * stack, not the only one.
     */
    template.hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311Poller-Test" });
    /*
     * 2 — the poller's own Schedule and 6-order-scheduling.md's
     * Nyc311OrderSchedulingSchedule. 7-data-warehousing.md §8's warehouse
     * job schedule is gone as a CDK-declared resource as of Leg 8 — each
     * job's Schedule is created/deleted at runtime, not synthesized here.
     */
    template.resourceCountIs("AWS::Scheduler::Schedule", 2);
  });

  it("wires the order-ingestion fan-out Lambda and its SQS queue (3-order-ingestion.md §2)", () => {
    const { template } = testEnv;

    template.hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311RequestsFanOut-Test" });
    template.hasResourceProperties("AWS::SQS::Queue", { QueueName: "Nyc311OrderIngestionQueue-Test" });
  });

  it("wires the request-evaluation Lambda, Locations/Orders tables (3-order-ingestion.md §3)", () => {
    const { template } = testEnv;

    template.hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311RequestEvaluation-Test" });
    template.hasResourceProperties("AWS::DynamoDB::GlobalTable", { TableName: "Locations-Test" });
    template.hasResourceProperties("AWS::DynamoDB::GlobalTable", { TableName: "Orders-Test" });
    /*
     * 6 = the Requests-side fan-out Lambda's stream mapping, the request-
     * evaluation Lambda's SQS mapping, the Orders-side fan-out Lambda's
     * own stream mapping, (5-order-evaluation.md §6) the evaluation
     * Lambda's SQS mapping, (7-data-warehousing.md §4) the Locations
     * fan-out Lambda's stream mapping, and (Leg 6) the Operators fan-out
     * Lambda's stream mapping.
     */
    template.resourceCountIs("AWS::Lambda::EventSourceMapping", 6);
  });

  it("wires the order-evaluation fan-out Lambda and its SNS topic (5-order-evaluation.md §3)", () => {
    const { template } = testEnv;

    template.hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311OrdersStreamFanOut-Test" });
    template.hasResourceProperties("AWS::SNS::Topic", { TopicName: "Nyc311OrderEvents-Test" });
  });

  it("wires the evaluation queue (filtered to ORDER_CREATED) and the evaluation Lambda (5-order-evaluation.md §3/§6)", () => {
    const { template } = testEnv;

    template.hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311OrderEvaluation-Test" });
    template.hasResourceProperties("AWS::SQS::Queue", { QueueName: "Nyc311OrderEvaluationQueue-Test" });
    template.hasResourceProperties("AWS::SNS::Subscription", {
      Protocol: "sqs",
      RawMessageDelivery: true,
      FilterPolicy: { event_type: ["ORDER_CREATED"] },
    });
  });

  it("wires CloudWatch alarms for the fan-out Lambda and the evaluation DLQ (5-order-evaluation.md §7)", () => {
    const { template } = testEnv;

    template.hasResourceProperties("AWS::CloudWatch::Alarm", { AlarmName: "Nyc311OrdersStreamFanOutErrorsAlarm-Test" });
    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "Nyc311OrdersStreamFanOutIteratorAgeAlarm-Test",
    });
    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "Nyc311OrderEvaluationDlqDepthAlarm-Test",
    });
    template.hasResourceProperties("AWS::SNS::Topic", { TopicName: "Nyc311OrderPipelineFailures-Test" });
  });

  it("wires the data-warehouse landing zone: bucket, Glue db + 7 tables (6 sources + job_results), workgroup, 6 Firehoses (7-data-warehousing.md §5-§7/§11, Leg 6)", () => {
    const { template } = testEnv;

    template.hasResourceProperties("AWS::S3::Bucket", { BucketName: "nyc311-warehouse-test" });
    template.hasResourceProperties("AWS::Glue::Database", { DatabaseInput: { Name: "nyc311_warehouse_test" } });
    template.resourceCountIs("AWS::Glue::Table", 7);
    template.hasResourceProperties("AWS::Glue::Table", { TableInput: { Name: "job_results" } });
    template.hasResourceProperties("AWS::Glue::Table", { TableInput: { Name: "locations" } });
    template.hasResourceProperties("AWS::Glue::Table", { TableInput: { Name: "operator_events" } });
    template.hasResourceProperties("AWS::Glue::Table", { TableInput: { Name: "operator_snapshots" } });
    template.hasResourceProperties("AWS::Athena::WorkGroup", { Name: "Nyc311Analytics-Test" });
    template.resourceCountIs("AWS::KinesisFirehose::DeliveryStream", 6);
    for (const name of [
      "Nyc311Warehouse-OrderEvents-Test",
      "Nyc311Warehouse-OrderSnapshots-Test",
      "Nyc311Warehouse-Requests-Test",
      "Nyc311Warehouse-Locations-Test",
      "Nyc311Warehouse-OperatorEvents-Test",
      "Nyc311Warehouse-OperatorSnapshots-Test",
    ]) {
      template.hasResourceProperties("AWS::KinesisFirehose::DeliveryStream", { DeliveryStreamName: name });
    }
    template.hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311WarehouseTransform-Test" });
    /* Each of the 3 warehouse topics gets a firehose subscription; the ingestion queue's is the only SQS one. */
    template.hasResourceProperties("AWS::SNS::Subscription", { Protocol: "firehose", RawMessageDelivery: true });
  });

  it("wires the order-scheduling Lambda, its hourly schedule, and IAM scoping (6-order-scheduling.md §1/§8)", () => {
    const { template } = testEnv;

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "Nyc311OrderScheduling-Test",
    });
    template.hasResourceProperties("AWS::Scheduler::Schedule", {
      Name: "Nyc311OrderSchedulingSchedule-Test",
      ScheduleExpression: "rate(1 hour)",
    });
    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "Nyc311OrderSchedulingFailureAlarm-Test",
    });
  });

  it("wires the warehouse job runner, its schedule group + admin job routes, and the 3 GET /data/* routes (7-data-warehousing.md §8-§12, Leg 8)", () => {
    const { template } = testEnv;

    template.hasResourceProperties("AWS::DynamoDB::GlobalTable", { TableName: "WarehouseJobRuns-Test" });
    /* AnalyticsRollups is gone — job output is S3/Athena now (§11) */
    expect(
      Object.values(template.findResources("AWS::DynamoDB::GlobalTable")).some(
        (t) => (t.Properties as { TableName?: string }).TableName === "AnalyticsRollups-Test"
      )
    ).toBe(false);
    template.hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311WarehouseJobRunner-Test" });
    /* Leg 8 — no more CDK-declared daily Schedule; per-job schedules are created at runtime under this group. */
    template.hasResourceProperties("AWS::Scheduler::ScheduleGroup", { Name: "Nyc311WarehouseJobs-Test" });
    template.hasResourceProperties("AWS::IAM::Role", { RoleName: "Nyc311WarehouseJobScheduleRole-Test" });
    template.hasResourceProperties("AWS::CloudWatch::Alarm", { AlarmName: "Nyc311WarehouseJobsFailureAlarm-Test" });
    template.hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311CreateWarehouseJobApi-Test" });
    template.hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311DeleteWarehouseJobApi-Test" });
    template.hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311ListWarehouseJobsApi-Test" });

    /* §10 Leg 4 — the on-demand rebuild state machine + its worker Lambda + the ARN output. */
    template.hasResourceProperties("AWS::StepFunctions::StateMachine", { StateMachineName: "Nyc311WarehouseRebuild-Test" });
    template.hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311WarehouseRebuildWorker-Test" });
    template.hasOutput("Nyc311WarehouseRebuildStateMachineArn", {});

    for (const routeKey of ["GET /data/schema", "GET /data/jobs", "GET /data/jobs/{name}/result"]) {
      template.hasResourceProperties("AWS::ApiGatewayV2::Route", { RouteKey: routeKey });
    }
    for (const fn of ["Nyc311WarehouseSchemaApi-Test", "Nyc311WarehouseJobsApi-Test", "Nyc311JobResultApi-Test"]) {
      template.hasResourceProperties("AWS::Lambda::Function", { FunctionName: fn });
    }
  });

  it("wires WebsiteHosting (S3 + CloudFront) for web-app/, per claude-prompt-initial.md's hosting decision", () => {
    const { template } = testEnv;

    template.hasResourceProperties("AWS::S3::Bucket", { BucketName: "nyc311-web-test" });
    template.resourceCountIs("AWS::CloudFront::Distribution", 1);
  });

  it("assigns the custom domains per environment (8-domain-name-assignment.md §1)", () => {
    testEnv.template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({ Aliases: ["test.boroughsim.com"] }),
    });
    testEnv.template.hasResourceProperties("AWS::ApiGatewayV2::DomainName", { DomainName: "api.test.boroughsim.com" });
    testEnv.template.hasResourceProperties("AWS::Route53::RecordSet", {
      Name: "test.boroughsim.com.",
      Type: "A",
    });
    testEnv.template.hasResourceProperties("AWS::Route53::RecordSet", {
      Name: "api.test.boroughsim.com.",
      Type: "A",
    });

    prodEnv.template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({ Aliases: ["boroughsim.com"] }),
    });
    prodEnv.template.hasResourceProperties("AWS::ApiGatewayV2::DomainName", { DomainName: "api.boroughsim.com" });
  });

  it("wires the public API Gateway with its first route, GET /ingestion/metrics (1-data-ingestion.md §8a)", () => {
    const { template } = testEnv;

    template.hasResourceProperties("AWS::ApiGatewayV2::Api", { Name: "Nyc311Api-Test" });
    template.hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311MetricsApi-Test" });
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", { RouteKey: "GET /ingestion/metrics" });
    template.hasOutput("Nyc311ApiUrl", {});
  });

  it("wires GET /lambda-metrics to the Lambda health Lambda, with every monitored function name set (2026-08-22 incident)", () => {
    const { template } = testEnv;

    template.hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311LambdaMetricsApi-Test" });
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", { RouteKey: "GET /lambda-metrics" });
    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: Match.objectLike({
          MONITORED_LAMBDA_POLLER: { Ref: Match.stringLikeRegexp("^Nyc311PollerLambda") },
          MONITORED_LAMBDA_ORDER_FAN_OUT: { Ref: Match.stringLikeRegexp("^Nyc311RequestsFanOutLambda") },
          MONITORED_LAMBDA_REQUEST_EVALUATION: { Ref: Match.stringLikeRegexp("^Nyc311RequestEvaluationLambda") },
          MONITORED_LAMBDA_ORDER_EVENT_FAN_OUT: { Ref: Match.stringLikeRegexp("^Nyc311OrdersStreamFanOutLambda") },
          MONITORED_LAMBDA_ORDER_EVALUATION: { Ref: Match.stringLikeRegexp("^Nyc311OrderEvaluationLambda") },
          MONITORED_LAMBDA_ORDER_SCHEDULING: { Ref: Match.stringLikeRegexp("^Nyc311OrderSchedulingLambda") },
          MONITORED_LAMBDA_METRICS_API: { Ref: Match.stringLikeRegexp("^Nyc311MetricsApiLambda") },
          MONITORED_LAMBDA_WAREHOUSE_JOB_RUNNER: { Ref: Match.stringLikeRegexp("^Nyc311WarehouseJobRunnerLambda") },
          MONITORED_LAMBDA_WAREHOUSE_SCHEMA_API: { Ref: Match.stringLikeRegexp("^Nyc311WarehouseSchemaApiLambda") },
          MONITORED_LAMBDA_WAREHOUSE_JOBS_API: { Ref: Match.stringLikeRegexp("^Nyc311WarehouseJobsApiLambda") },
          MONITORED_LAMBDA_JOB_RESULT_API: { Ref: Match.stringLikeRegexp("^Nyc311JobResultApiLambda") },
          MONITORED_LAMBDA_PIPELINE_STATUS: "Nyc311PipelineStatus",
        }),
      },
    });
  });

  it("never exceeds the 10-custom-metric cap (1-data-ingestion.md §8), in either environment", () => {
    expect(
      Object.keys(testEnv.template.findResources("AWS::Logs::MetricFilter")).length,
    ).toBeLessThanOrEqual(10);
    expect(
      Object.keys(prodEnv.template.findResources("AWS::Logs::MetricFilter")).length,
    ).toBeLessThanOrEqual(10);
  });
});
