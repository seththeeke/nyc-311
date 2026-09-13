import * as path from "node:path";
import { Duration } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime, StartingPosition } from "aws-cdk-lib/aws-lambda";
import { DynamoEventSource, SqsDlq } from "aws-cdk-lib/aws-lambda-event-sources";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";
import type { OperatorsTable } from "../data/OperatorsTable";
import type { Nyc311OperatorEventsTopic } from "./Nyc311OperatorEventsTopic";
import type { Nyc311OperatorProjectionsTopic } from "./Nyc311OperatorProjectionsTopic";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311OperatorsStreamFanOutLambdaProps {
  envName: Nyc311Environment;
  operatorsTable: OperatorsTable;
  operatorEventsTopic: Nyc311OperatorEventsTopic;
  operatorProjectionsTopic: Nyc311OperatorProjectionsTopic;
}

/*
 * 7-data-warehousing.md §4 — same numbers as the Orders/Requests-side
 * fan-outs, no reason to invent new ones.
 */
const BATCH_SIZE = 100;
const RETRY_ATTEMPTS = 3;

/**
 * The `Operators` table's first DynamoDB Stream consumer
 * (`7-data-warehousing.md` §4, Leg 6, 2026-09-13). Routes each record by
 * its `sk`: an `EVENT#` item to {@link Nyc311OperatorEventsTopic}, a
 * `#METADATA` change to {@link Nyc311OperatorProjectionsTopic} — the same
 * dual-topic shape as `Nyc311OrdersStreamFanOutLambda`, since `Operators`
 * is event-sourced too. Unlike `Orders`, neither topic has an operational
 * subscriber — both feed the warehouse only.
 */
export class Nyc311OperatorsStreamFanOutLambda extends NodejsFunction {
  public readonly fanOutLogGroup: logs.LogGroup;
  public readonly onFailureDeadLetterQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: Nyc311OperatorsStreamFanOutLambdaProps) {
    const suffix = ENV_NAME_SUFFIX[props.envName];
    const functionName = `Nyc311OperatorsStreamFanOut-${suffix}`;

    const fanOutLogGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`, /* matches Lambda's own default log group naming convention */
      retention: logs.RetentionDays.ONE_MONTH,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "ingestion", "fanOutOperatorEventsController.ts"),
      handler: "fanOutOperatorEventsController",
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
        OPERATOR_EVENTS_TOPIC_ARN: props.operatorEventsTopic.topic.topicArn,
        OPERATOR_PROJECTIONS_TOPIC_ARN: props.operatorProjectionsTopic.topic.topicArn,
      },
    });

    this.fanOutLogGroup = fanOutLogGroup;

    /*
     * Same known asymmetry as the other fan-outs: this on-failure
     * destination only ever carries stream metadata for a failed batch,
     * never the actual record content — accepted for consistency with
     * established precedent.
     */
    this.onFailureDeadLetterQueue = new sqs.Queue(this, "OnFailureDlq", {
      queueName: `Nyc311OperatorsStreamFanOutDlq-${suffix}`,
      retentionPeriod: Duration.days(14),
      enforceSSL: true,
    });

    /*
     * grantStreamRead is applied automatically by DynamoEventSource.bind()
     * — not hand-rolled here.
     */
    this.addEventSource(
      new DynamoEventSource(props.operatorsTable, {
        startingPosition: StartingPosition.LATEST,
        batchSize: BATCH_SIZE,
        reportBatchItemFailures: true,
        retryAttempts: RETRY_ATTEMPTS,
        onFailure: new SqsDlq(this.onFailureDeadLetterQueue),
        /* No FilterCriteria — relevance filtering happens inside the handler. */
      })
    );

    /*
     * Least privilege: this Lambda only ever publishes — it never reads
     * from or writes to Operators (`7-data-warehousing.md` §4/§15).
     */
    props.operatorEventsTopic.topic.grantPublish(this);
    props.operatorProjectionsTopic.topic.grantPublish(this);
  }
}
