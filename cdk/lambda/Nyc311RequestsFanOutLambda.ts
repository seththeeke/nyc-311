import * as path from "node:path";
import { Duration } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime, StartingPosition } from "aws-cdk-lib/aws-lambda";
import { DynamoEventSource, SqsDlq } from "aws-cdk-lib/aws-lambda-event-sources";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";
import type { RequestsTable } from "../data/RequestsTable";
import type { Nyc311RequestEventsTopic } from "./Nyc311RequestEventsTopic";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311RequestsFanOutLambdaProps {
  envName: Nyc311Environment;
  requestsTable: RequestsTable;
  requestEventsTopic: Nyc311RequestEventsTopic;
}

/*
 * 3-order-ingestion.md §2.1 — batchSize 100 drains a full poller burst in
 * a bounded number of invocations; per-item failure isolation
 * (reportBatchItemFailures) is what keeps that batch size's larger blast
 * radius from being a correctness problem.
 */
const BATCH_SIZE = 100;

/*
 * Matches the poller's own retry budget (1-data-ingestion.md §5) and the
 * downstream queue's own maxReceiveCount — one consistent retry budget
 * across this whole pipeline.
 */
const RETRY_ATTEMPTS = 3;

/**
 * The `Requests` table's sole DynamoDB Stream consumer (renamed from
 * `Nyc311OrderFanOutLambda`). Publishes every real `Request` row change
 * (`INSERT`/`MODIFY`) onto {@link Nyc311RequestEventsTopic}, tagged
 * `event_name` (`7-data-warehousing.md` §4) — the ingestion queue takes
 * `INSERT` via a filter policy, the `requests` warehouse Firehose takes
 * all. No DAO calls; per-item failure isolation.
 */
export class Nyc311RequestsFanOutLambda extends NodejsFunction {
  public readonly fanOutLogGroup: logs.LogGroup;
  public readonly onFailureDeadLetterQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: Nyc311RequestsFanOutLambdaProps) {
    const suffix = ENV_NAME_SUFFIX[props.envName];
    const functionName = `Nyc311RequestsFanOut-${suffix}`;

    const fanOutLogGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`, /* matches Lambda's own default log group naming convention */
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
      /*
       * backend/ is its own npm package (own lockfile/node_modules),
       * separate from cdk/ — see Nyc311PollerLambda.ts for why both
       * projectRoot and depsLockFilePath must point at it explicitly.
       */
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        REQUEST_EVENTS_TOPIC_ARN: props.requestEventsTopic.topic.topicArn,
      },
    });

    this.fanOutLogGroup = fanOutLogGroup;

    /*
     * Agreed 2026-08-18 (3-order-ingestion.md §2.3): this on-failure
     * destination only ever carries stream metadata (shard ID,
     * sequence-number range) for a failed batch — never the actual record
     * content, unlike the downstream queue's own redrive-to-DLQ. Chosen
     * anyway for consistency with the poller's established pattern.
     */
    this.onFailureDeadLetterQueue = new sqs.Queue(this, "OnFailureDlq", {
      queueName: `Nyc311RequestsFanOutDlq-${suffix}`,
      retentionPeriod: Duration.days(14),
      enforceSSL: true,
    });

    /*
     * grantStreamRead is applied automatically by DynamoEventSource.bind()
     * — not hand-rolled here.
     */
    this.addEventSource(
      new DynamoEventSource(props.requestsTable, {
        startingPosition: StartingPosition.LATEST,
        batchSize: BATCH_SIZE,
        reportBatchItemFailures: true,
        retryAttempts: RETRY_ATTEMPTS,
        onFailure: new SqsDlq(this.onFailureDeadLetterQueue),
        /*
         * No `filters` prop — relevance filtering happens inside the
         * handler (3-order-ingestion.md §2.1), against my own
         * recommendation to filter here.
         */
      })
    );

    /*
     * Least privilege: this Lambda only ever publishes — it never reads
     * from or writes to Requests/Orders (`7-data-warehousing.md` §15).
     * Replaces the old `queue.grantSendMessages` grant.
     */
    props.requestEventsTopic.topic.grantPublish(this);
  }
}
