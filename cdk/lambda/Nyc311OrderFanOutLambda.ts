import * as path from "node:path";
import { Duration } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime, StartingPosition } from "aws-cdk-lib/aws-lambda";
import { DynamoEventSource, SqsDlq } from "aws-cdk-lib/aws-lambda-event-sources";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";
import type { RequestsTable } from "../data/RequestsTable";
import type { Nyc311OrderIngestionQueue } from "./Nyc311OrderIngestionQueue";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311OrderFanOutLambdaProps {
  envName: Nyc311Environment;
  requestsTable: RequestsTable;
  orderIngestionQueue: Nyc311OrderIngestionQueue;
}

// 3-order-ingestion.md §2.1 — batchSize 100 drains a full 2000-record
// poller burst (PER_RUN_RECORD_CAP, 1-data-ingestion.md) in 20
// invocations; per-item failure isolation (reportBatchItemFailures) is
// what keeps that batch size's larger blast radius from being a
// correctness problem.
const BATCH_SIZE = 100;

// Matches the poller's own retry budget (1-data-ingestion.md §5) and the
// downstream queue's own maxReceiveCount (Nyc311OrderIngestionQueue) — one
// consistent retry budget across this whole pipeline.
const RETRY_ATTEMPTS = 3;

/**
 * The `Requests` table stream's fan-out Lambda — "the listener" designed
 * in `3-order-ingestion.md` §2. Its entire job is deciding which stream
 * records are a real, newly-ingested `Request` (in-handler, not
 * `FilterCriteria` — §2.1) and republishing those onto
 * {@link Nyc311OrderIngestionQueue}. No filter/promotion logic, no DAO
 * calls — that all belongs to the downstream request-processor Lambda,
 * not yet built.
 *
 * Event source mapping uses per-item failure isolation
 * (`reportBatchItemFailures`) rather than `bisectBatchOnError` — with
 * per-item reporting already telling AWS precisely which records failed,
 * batch-bisection has nothing left to do (§2.3).
 */
export class Nyc311OrderFanOutLambda extends NodejsFunction {
  public readonly fanOutLogGroup: logs.LogGroup;
  public readonly onFailureDeadLetterQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: Nyc311OrderFanOutLambdaProps) {
    const suffix = ENV_NAME_SUFFIX[props.envName];
    const functionName = `Nyc311OrderFanOut-${suffix}`;

    const fanOutLogGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`, // matches Lambda's own default log group naming convention
      retention: logs.RetentionDays.ONE_MONTH,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "ingestion", "fanOutRequestEventsController.ts"),
      handler: "fanOutRequestEventsController",
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(30),
      memorySize: 256,
      logGroup: fanOutLogGroup,
      // backend/ is its own npm package (own lockfile/node_modules),
      // separate from cdk/ — see Nyc311PollerLambda.ts for why both
      // projectRoot and depsLockFilePath must point at it explicitly.
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        ORDER_INGESTION_QUEUE_URL: props.orderIngestionQueue.queue.queueUrl,
      },
    });

    this.fanOutLogGroup = fanOutLogGroup;

    // Agreed 2026-08-18 (3-order-ingestion.md §2.3): this on-failure
    // destination only ever carries stream metadata (shard ID,
    // sequence-number range) for a failed batch — never the actual record
    // content, unlike Nyc311OrderIngestionQueue's own redrive-to-DLQ.
    // Chosen anyway for consistency with the poller's established pattern.
    this.onFailureDeadLetterQueue = new sqs.Queue(this, "OnFailureDlq", {
      queueName: `Nyc311OrderFanOutDlq-${suffix}`,
      retentionPeriod: Duration.days(14),
      enforceSSL: true,
    });

    // grantStreamRead is applied automatically by DynamoEventSource.bind()
    // — not hand-rolled here.
    this.addEventSource(
      new DynamoEventSource(props.requestsTable, {
        startingPosition: StartingPosition.LATEST,
        batchSize: BATCH_SIZE,
        reportBatchItemFailures: true,
        retryAttempts: RETRY_ATTEMPTS,
        onFailure: new SqsDlq(this.onFailureDeadLetterQueue),
        // No `filters` prop — relevance filtering happens inside the
        // handler (§2.1), against my own recommendation to filter here.
      })
    );

    // Least privilege: the fan-out Lambda only ever publishes — it never
    // reads from or writes to Requests/Orders (§2.1's IAM scoping).
    props.orderIngestionQueue.queue.grantSendMessages(this);
  }
}
