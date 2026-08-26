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
import { Nyc311OrderFanOutLambda } from "../lambda/Nyc311OrderFanOutLambda";
import { Nyc311RequestEvaluationLambda } from "../lambda/Nyc311RequestEvaluationLambda";
import { Nyc311OrderEventsTopic } from "../lambda/Nyc311OrderEventsTopic";
import { Nyc311OrderEventFanOutLambda } from "../lambda/Nyc311OrderEventFanOutLambda";
import { Nyc311OrderEvaluationQueue } from "../lambda/Nyc311OrderEvaluationQueue";
import { Nyc311OrderEvaluationLambda } from "../lambda/Nyc311OrderEvaluationLambda";
import { Nyc311OrderEventsApiLambda } from "../lambda/Nyc311OrderEventsApiLambda";
import { Nyc311OrderPipelineAlarms } from "../lambda/Nyc311OrderPipelineAlarms";
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
     * 3-order-ingestion.md §2 — the order-ingestion fan-out Lambda: listens
     * to the Requests table's DynamoDB Stream and republishes relevant
     * records onto this queue.
     */
    const orderIngestionQueue = new Nyc311OrderIngestionQueue(this, "Nyc311OrderIngestionQueue", {
      envName: props.envName,
    });

    const orderFanOutLambda = new Nyc311OrderFanOutLambda(this, "Nyc311OrderFanOutLambda", {
      envName: props.envName,
      requestsTable,
      orderIngestionQueue,
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
     * 5-order-evaluation.md §3 — the order-evaluation fan-out Lambda:
     * listens to the Orders table's own DynamoDB Stream and republishes
     * every appended OrderEvent onto this topic, tagged with an
     * event_type message attribute for downstream filtered subscriptions.
     */
    const orderEventsTopic = new Nyc311OrderEventsTopic(this, "Nyc311OrderEventsTopic", {
      envName: props.envName,
    });

    const orderEventFanOutLambda = new Nyc311OrderEventFanOutLambda(this, "Nyc311OrderEventFanOutLambda", {
      envName: props.envName,
      ordersTable,
      orderEventsTopic,
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
      orderEventFanOutLambda,
      orderEvaluationQueue,
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
      orderFanOutFunctionName: orderFanOutLambda.functionName,
      requestEvaluationFunctionName: requestEvaluationLambda.functionName,
      orderEventFanOutFunctionName: orderEventFanOutLambda.functionName,
      orderEvaluationFunctionName: orderEvaluationLambda.functionName,
      metricsApiFunctionName: metricsApiLambda.functionName,
      ordersApiFunctionName: ordersApiLambda.functionName,
      orderEventsApiFunctionName: orderEventsApiLambda.functionName,
    });

    const nyc311Api = new Nyc311Api(this, "Nyc311Api", {
      envName: props.envName,
      metricsApiLambda,
      ordersApiLambda,
      orderEventsApiLambda,
      lambdaMetricsApiLambda,
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
