import * as path from "node:path";
import { Duration } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime, StartingPosition } from "aws-cdk-lib/aws-lambda";
import { DynamoEventSource, SqsDlq } from "aws-cdk-lib/aws-lambda-event-sources";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";
import type { OrdersTable } from "../data/OrdersTable";
import type { Nyc311OrderEventsTopic } from "./Nyc311OrderEventsTopic";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311OrderEventFanOutLambdaProps {
  envName: Nyc311Environment;
  ordersTable: OrdersTable;
  orderEventsTopic: Nyc311OrderEventsTopic;
}

/*
 * 5-order-evaluation.md §3 — same numbers as the Requests-side fan-out
 * (Nyc311OrderFanOutLambda.ts), no reason to invent new ones: batchSize
 * 100 drains a full burst in a bounded number of invocations, per-item
 * failure isolation (reportBatchItemFailures) keeps that larger blast
 * radius from being a correctness problem.
 */
const BATCH_SIZE = 100;
const RETRY_ATTEMPTS = 3;

/**
 * The `Orders` stream's fan-out Lambda (`5-order-evaluation.md` §3) — not
 * `Nyc311OrderFanOutLambda`, the differently-scoped, existing construct
 * that fans out the *Requests* table's stream onto the order-ingestion
 * queue. This one listens to `Orders` and forwards every appended
 * `OrderEvent` (never the `#METADATA` projection) onto
 * {@link Nyc311OrderEventsTopic}, tagged with an `event_type` attribute.
 * No DAO calls, no evaluation logic — that's the not-yet-built evaluation
 * Lambda's job.
 */
export class Nyc311OrderEventFanOutLambda extends NodejsFunction {
  public readonly fanOutLogGroup: logs.LogGroup;
  public readonly onFailureDeadLetterQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: Nyc311OrderEventFanOutLambdaProps) {
    const suffix = ENV_NAME_SUFFIX[props.envName];
    const functionName = `Nyc311OrderEventFanOut-${suffix}`;

    const fanOutLogGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`, /* matches Lambda's own default log group naming convention */
      retention: logs.RetentionDays.ONE_MONTH,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "order-processing", "fanOutOrderEventsController.ts"),
      handler: "fanOutOrderEventsController",
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(30),
      memorySize: 256,
      logGroup: fanOutLogGroup,
      /*
       * backend/ is its own npm package (own lockfile/node_modules),
       * separate from cdk/ — see Nyc311PollerLambda.ts for why both
       * projectRoot and depsLockFilePath must point at it explicitly.
       */
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        ORDER_EVENTS_TOPIC_ARN: props.orderEventsTopic.topic.topicArn,
      },
    });

    this.fanOutLogGroup = fanOutLogGroup;

    /*
     * Same known asymmetry as the Requests-side fan-out (5-order-
     * evaluation.md §3): this on-failure destination only ever carries
     * stream metadata for a failed batch, never the actual record content
     * — accepted for consistency with established precedent.
     */
    this.onFailureDeadLetterQueue = new sqs.Queue(this, "OnFailureDlq", {
      queueName: `Nyc311OrderEventFanOutDlq-${suffix}`,
      retentionPeriod: Duration.days(14),
      enforceSSL: true,
    });

    /*
     * grantStreamRead is applied automatically by DynamoEventSource.bind()
     * — not hand-rolled here.
     */
    this.addEventSource(
      new DynamoEventSource(props.ordersTable, {
        startingPosition: StartingPosition.LATEST,
        batchSize: BATCH_SIZE,
        reportBatchItemFailures: true,
        retryAttempts: RETRY_ATTEMPTS,
        onFailure: new SqsDlq(this.onFailureDeadLetterQueue),
        /* No FilterCriteria — relevance filtering happens inside the handler, same as Nyc311OrderFanOutLambda. */
      })
    );

    /*
     * Least privilege: the fan-out Lambda only ever publishes — it never
     * reads from or writes to Orders (5-order-evaluation.md §3's IAM
     * scoping).
     */
    props.orderEventsTopic.topic.grantPublish(this);
  }
}
