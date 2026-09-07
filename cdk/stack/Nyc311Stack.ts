import { CfnOutput, Stack, StackProps, Tags } from "aws-cdk-lib";
import type { Construct } from "constructs";
import { RequestsTable } from "../data/RequestsTable";
import { LocationsTable } from "../data/LocationsTable";
import { OrdersTable } from "../data/OrdersTable";
import { Nyc311PollerLambda } from "../lambda/Nyc311PollerLambda";
import { Nyc311PollerSchedule } from "../lambda/Nyc311PollerSchedule";
import { Nyc311MetricsApiLambda } from "../lambda/Nyc311MetricsApiLambda";
import { Nyc311OrdersApiLambda } from "../lambda/Nyc311OrdersApiLambda";
import { Nyc311LambdaMetricsApiLambda } from "../lambda/Nyc311LambdaMetricsApiLambda";
import { Nyc311OrderIngestionQueue } from "../lambda/Nyc311OrderIngestionQueue";
import { Nyc311RequestsFanOutLambda } from "../lambda/Nyc311RequestsFanOutLambda";
import { Nyc311RequestEventsTopic } from "../lambda/Nyc311RequestEventsTopic";
import { Nyc311RequestEvaluationLambda } from "../lambda/Nyc311RequestEvaluationLambda";
import { Nyc311OrderEventsTopic } from "../lambda/Nyc311OrderEventsTopic";
import { Nyc311OrdersStreamFanOutLambda } from "../lambda/Nyc311OrdersStreamFanOutLambda";
import { Nyc311OrderProjectionsTopic } from "../lambda/Nyc311OrderProjectionsTopic";
import { Nyc311OrderEvaluationQueue } from "../lambda/Nyc311OrderEvaluationQueue";
import { Nyc311OrderEvaluationLambda } from "../lambda/Nyc311OrderEvaluationLambda";
import { Nyc311OrderEventsApiLambda } from "../lambda/Nyc311OrderEventsApiLambda";
import { Nyc311OrderPipelineAlarms } from "../lambda/Nyc311OrderPipelineAlarms";
import { Nyc311OrderSchedulingLambda } from "../lambda/Nyc311OrderSchedulingLambda";
import { Nyc311OrderSchedulingSchedule } from "../lambda/Nyc311OrderSchedulingSchedule";
import { Nyc311WarehouseBucket } from "../warehouse/Nyc311WarehouseBucket";
import { Nyc311WarehouseCatalog } from "../warehouse/Nyc311WarehouseCatalog";
import { Nyc311AnalyticsWorkgroup } from "../warehouse/Nyc311AnalyticsWorkgroup";
import { Nyc311WarehouseTransformLambda } from "../warehouse/Nyc311WarehouseTransformLambda";
import { Nyc311WarehouseFirehose } from "../warehouse/Nyc311WarehouseFirehose";
import { WarehouseJobRunsTable } from "../data/WarehouseJobRunsTable";
import { Nyc311WarehouseJobRunnerLambda } from "../warehouse/Nyc311WarehouseJobRunnerLambda";
import { Nyc311WarehouseJobSchedule } from "../warehouse/Nyc311WarehouseJobSchedule";
import { Nyc311WarehouseSchemaApiLambda } from "../warehouse/Nyc311WarehouseSchemaApiLambda";
import { Nyc311WarehouseJobsApiLambda } from "../warehouse/Nyc311WarehouseJobsApiLambda";
import { Nyc311JobResultApiLambda } from "../warehouse/Nyc311JobResultApiLambda";
import { Nyc311Api } from "../api/Nyc311Api";
import { WebsiteHosting } from "../web/WebsiteHosting";
import { WebsiteDeployment } from "../web/WebsiteDeployment";

/* Enum-like discriminator, ALL_CAPS per CLAUDE.md §6. */
export type Nyc311Environment = "TEST" | "PROD";

export interface Nyc311StackProps extends StackProps {
  envName: Nyc311Environment;
}

/*
 * The shared per-environment physical-name suffix, per CLAUDE.md §5.3 —
 * every named resource in this stack is suffixed this way (not just
 * tagged) so it's identifiable at a glance in the console/CLI, not only
 * by which CloudFormation stack it belongs to. Title-case, not ALL_CAPS —
 * physical infrastructure names follow their own convention, per
 * CLAUDE.md §6's carve-out.
 */
export const ENV_NAME_SUFFIX: Record<Nyc311Environment, string> = {
  TEST: "Test",
  PROD: "Prod",
};

/*
 * 1-data-ingestion.md §5 — same address the pipeline's own failure
 * notifications already go to (pipeline/Nyc311PipelineStack.ts).
 */
const FAILURE_NOTIFICATION_EMAIL = "seththeeke@gmail.com";

/**
 * The application's single stack shape (CLAUDE.md §5.3) — one Stack class,
 * instantiated once per environment from `bin/app.ts`. Resources get added
 * via custom constructs under `lambda/`, `data/`, `web/`, etc. as each
 * `claude-prompt-initial.md` build-order slice is unlocked.
 */
export class Nyc311Stack extends Stack {
  /** 4-pipeline-integration-tests.md §5 — exposed so Nyc311AppStage can pass it to the pipeline's integration-test step via envFromCfnOutputs. */
  public readonly apiUrlOutput: CfnOutput;

  constructor(scope: Construct, id: string, props: Nyc311StackProps) {
    super(scope, id, props);

    Tags.of(this).add("Environment", props.envName);

    const requestsTable = new RequestsTable(this, "RequestsTable", { envName: props.envName });

    const pollerLambda = new Nyc311PollerLambda(this, "Nyc311PollerLambda", {
      envName: props.envName,
      requestsTable,
    });

    new Nyc311PollerSchedule(this, "Nyc311PollerSchedule", {
      envName: props.envName,
      pollerLambda,
      failureNotificationEmail: FAILURE_NOTIFICATION_EMAIL,
    });

    /*
     * 7-data-warehousing.md §4 — the Requests table's sole stream
     * consumer publishes every real Request row change here; the
     * order-ingestion queue subscribes with an INSERT-only filter policy
     * (unchanged behavior), the requests warehouse Firehose (Leg 2)
     * subscribes unfiltered.
     */
    const requestEventsTopic = new Nyc311RequestEventsTopic(this, "Nyc311RequestEventsTopic", {
      envName: props.envName,
    });

    const orderIngestionQueue = new Nyc311OrderIngestionQueue(this, "Nyc311OrderIngestionQueue", {
      envName: props.envName,
      requestEventsTopic,
    });

    const requestsFanOutLambda = new Nyc311RequestsFanOutLambda(this, "Nyc311RequestsFanOutLambda", {
      envName: props.envName,
      requestsTable,
      requestEventsTopic,
    });

    const locationsTable = new LocationsTable(this, "LocationsTable", { envName: props.envName });
    const ordersTable = new OrdersTable(this, "OrdersTable", { envName: props.envName });

    /* 3-order-ingestion.md §3 — consumes orderIngestionQueue, runs the filter pipeline, promotes/creates the Order. */
    const requestEvaluationLambda = new Nyc311RequestEvaluationLambda(this, "Nyc311RequestEvaluationLambda", {
      envName: props.envName,
      requestsTable,
      locationsTable,
      ordersTable,
      orderIngestionQueue,
    });

    /*
     * 5-order-evaluation.md §3 / 7-data-warehousing.md §4 — the Orders
     * table's sole stream consumer routes each appended OrderEvent onto
     * this topic (tagged event_type, for the evaluation pipeline) and
     * each #METADATA projection change onto Nyc311OrderProjectionsTopic
     * (tagged event_name, for the order_snapshots warehouse).
     */
    const orderEventsTopic = new Nyc311OrderEventsTopic(this, "Nyc311OrderEventsTopic", {
      envName: props.envName,
    });

    const orderProjectionsTopic = new Nyc311OrderProjectionsTopic(this, "Nyc311OrderProjectionsTopic", {
      envName: props.envName,
    });

    const ordersStreamFanOutLambda = new Nyc311OrdersStreamFanOutLambda(this, "Nyc311OrdersStreamFanOutLambda", {
      envName: props.envName,
      ordersTable,
      orderEventsTopic,
      orderProjectionsTopic,
    });

    /*
     * 5-order-evaluation.md §3/§6 — Leg 2: the filtered subscription
     * (ORDER_CREATED only) and the Lambda that actually evaluates an
     * Order — accept, reject, or hand off to a Case.
     */
    const orderEvaluationQueue = new Nyc311OrderEvaluationQueue(this, "Nyc311OrderEvaluationQueue", {
      envName: props.envName,
      orderEventsTopic,
    });

    const orderEvaluationLambda = new Nyc311OrderEvaluationLambda(this, "Nyc311OrderEvaluationLambda", {
      envName: props.envName,
      ordersTable,
      orderEvaluationQueue,
    });

    new Nyc311OrderPipelineAlarms(this, "Nyc311OrderPipelineAlarms", {
      envName: props.envName,
      ordersStreamFanOutLambda,
      orderEvaluationQueue,
      failureNotificationEmail: FAILURE_NOTIFICATION_EMAIL,
    });

    /*
     * 7-data-warehousing.md §5-§7 (Leg 2) — the landing zone: an S3 bucket,
     * a Glue database + three external Parquet tables with partition
     * projection, an Athena workgroup, and three Firehoses (SNS → transform
     * Lambda → Parquet) landing order_events / order_snapshots / requests
     * under data/<table>/dt=<date>/.
     */
    const warehouseBucket = new Nyc311WarehouseBucket(this, "Nyc311WarehouseBucket", { envName: props.envName });
    const warehouseCatalog = new Nyc311WarehouseCatalog(this, "Nyc311WarehouseCatalog", {
      envName: props.envName,
      warehouseBucket,
    });
    const analyticsWorkgroup = new Nyc311AnalyticsWorkgroup(this, "Nyc311AnalyticsWorkgroup", {
      envName: props.envName,
      warehouseBucket,
    });
    const warehouseTransformLambda = new Nyc311WarehouseTransformLambda(this, "Nyc311WarehouseTransformLambda", {
      envName: props.envName,
    });

    new Nyc311WarehouseFirehose(this, "Nyc311WarehouseOrderEventsFirehose", {
      envName: props.envName,
      label: "OrderEvents",
      tableName: "order_events",
      sourceTopic: orderEventsTopic.topic,
      glueTable: warehouseCatalog.tables["order_events"],
      warehouseBucket,
      transformLambda: warehouseTransformLambda,
    });
    new Nyc311WarehouseFirehose(this, "Nyc311WarehouseOrderSnapshotsFirehose", {
      envName: props.envName,
      label: "OrderSnapshots",
      tableName: "order_snapshots",
      sourceTopic: orderProjectionsTopic.topic,
      glueTable: warehouseCatalog.tables["order_snapshots"],
      warehouseBucket,
      transformLambda: warehouseTransformLambda,
    });
    new Nyc311WarehouseFirehose(this, "Nyc311WarehouseRequestsFirehose", {
      envName: props.envName,
      label: "Requests",
      tableName: "requests",
      sourceTopic: requestEventsTopic.topic,
      glueTable: warehouseCatalog.tables["requests"],
      warehouseBucket,
      transformLambda: warehouseTransformLambda,
    });

    /*
     * 7-data-warehousing.md §8-§12 — the reporting substrate. One DynamoDB
     * table (WarehouseJobRuns: run history + automatic retry, pointer to
     * each run's S3 resultset), one generic Lambda runner on a `rate(1 day)`
     * EventBridge Schedule (DLQ + failure alarm) that writes every job's
     * result verbatim to `job-results/` in the warehouse bucket (the
     * catalog's CDK-declared `job_results` Glue table sits over it), and
     * three read-only API Lambdas behind
     * `GET /data/{schema,jobs,jobs/{name}/result}`.
     */
    const warehouseJobRunsTable = new WarehouseJobRunsTable(this, "WarehouseJobRunsTable", { envName: props.envName });

    const warehouseJobRunnerLambda = new Nyc311WarehouseJobRunnerLambda(this, "Nyc311WarehouseJobRunnerLambda", {
      envName: props.envName,
      jobRunsTable: warehouseJobRunsTable,
      warehouseBucket,
      warehouseCatalog,
      analyticsWorkgroup,
    });

    new Nyc311WarehouseJobSchedule(this, "Nyc311WarehouseJobSchedule", {
      envName: props.envName,
      jobRunnerLambda: warehouseJobRunnerLambda,
      failureNotificationEmail: FAILURE_NOTIFICATION_EMAIL,
    });

    const warehouseSchemaApiLambda = new Nyc311WarehouseSchemaApiLambda(this, "Nyc311WarehouseSchemaApiLambda", {
      envName: props.envName,
      warehouseCatalog,
    });

    const warehouseJobsApiLambda = new Nyc311WarehouseJobsApiLambda(this, "Nyc311WarehouseJobsApiLambda", {
      envName: props.envName,
      jobRunsTable: warehouseJobRunsTable,
    });

    const jobResultApiLambda = new Nyc311JobResultApiLambda(this, "Nyc311JobResultApiLambda", {
      envName: props.envName,
      jobRunsTable: warehouseJobRunsTable,
      warehouseBucket,
    });

    /*
     * 6-order-scheduling.md — the job-based, prioritized dispatch of Orders
     * waiting in SCHEDULE against mock capacity. Runs hourly.
     */
    const orderSchedulingLambda = new Nyc311OrderSchedulingLambda(this, "Nyc311OrderSchedulingLambda", {
      envName: props.envName,
      ordersTable,
      requestsTable,
      locationsTable,
    });

    new Nyc311OrderSchedulingSchedule(this, "Nyc311OrderSchedulingSchedule", {
      envName: props.envName,
      orderSchedulingLambda,
      failureNotificationEmail: FAILURE_NOTIFICATION_EMAIL,
    });

    const websiteHosting = new WebsiteHosting(this, "WebsiteHosting", { envName: props.envName });

    const metricsApiLambda = new Nyc311MetricsApiLambda(this, "Nyc311MetricsApiLambda", {
      envName: props.envName,
      requestsTable,
    });

    /* 3-order-ingestion.md's Order list view — backs the public `GET /orders` route. */
    const ordersApiLambda = new Nyc311OrdersApiLambda(this, "Nyc311OrdersApiLambda", {
      envName: props.envName,
      ordersTable,
    });

    /* 5-order-evaluation.md's Order Events list view — backs the public `GET /order-events` route. */
    const orderEventsApiLambda = new Nyc311OrderEventsApiLambda(this, "Nyc311OrderEventsApiLambda", {
      envName: props.envName,
      ordersTable,
    });

    /* The Lambda health tile, added after the 2026-08-22 fan-out-Lambda incident — backs the public `GET /lambda-metrics` route. */
    const lambdaMetricsApiLambda = new Nyc311LambdaMetricsApiLambda(this, "Nyc311LambdaMetricsApiLambda", {
      envName: props.envName,
      pollerFunctionName: pollerLambda.functionName,
      orderFanOutFunctionName: requestsFanOutLambda.functionName,
      requestEvaluationFunctionName: requestEvaluationLambda.functionName,
      orderEventFanOutFunctionName: ordersStreamFanOutLambda.functionName,
      orderEvaluationFunctionName: orderEvaluationLambda.functionName,
      orderSchedulingFunctionName: orderSchedulingLambda.functionName,
      metricsApiFunctionName: metricsApiLambda.functionName,
      ordersApiFunctionName: ordersApiLambda.functionName,
      orderEventsApiFunctionName: orderEventsApiLambda.functionName,
      warehouseJobRunnerFunctionName: warehouseJobRunnerLambda.functionName,
      warehouseSchemaApiFunctionName: warehouseSchemaApiLambda.functionName,
      warehouseJobsApiFunctionName: warehouseJobsApiLambda.functionName,
      jobResultApiFunctionName: jobResultApiLambda.functionName,
    });

    const nyc311Api = new Nyc311Api(this, "Nyc311Api", {
      envName: props.envName,
      metricsApiLambda,
      ordersApiLambda,
      orderEventsApiLambda,
      lambdaMetricsApiLambda,
      warehouseSchemaApiLambda,
      warehouseJobsApiLambda,
      jobResultApiLambda,
      webAppDomainName: websiteHosting.distribution.domainName,
    });

    /*
     * Read by test-scripts/2-metrics-api-test.py (and any future
     * integration test) via `aws cloudformation describe-stacks`, so the
     * deployed API's base URL doesn't have to be hand-copied out of the
     * console.
     */
    this.apiUrlOutput = new CfnOutput(this, "Nyc311ApiUrl", { value: nyc311Api.apiEndpoint });

    /*
     * Deploys web-app/dist + the runtime env-config.json last, once both
     * WebsiteHosting (for the bucket/distribution) and Nyc311Api (for the
     * API URL that config.json carries) exist — see WebsiteHosting.ts's
     * doc comment for why this can't happen inside either of those two
     * constructs without a circular dependency between them.
     */
    new WebsiteDeployment(this, "WebsiteDeployment", {
      websiteHosting,
      apiBaseUrl: nyc311Api.apiEndpoint,
    });
  }
}
