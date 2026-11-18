import { Duration } from "aws-cdk-lib";
import { StartingPosition } from "aws-cdk-lib/aws-lambda";
import { DynamoEventSource, SqsDlq } from "aws-cdk-lib/aws-lambda-event-sources";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";
import type { OperatorsTable } from "../data/OperatorsTable";
import type { Nyc311OperatorEventsTopic } from "./Nyc311OperatorEventsTopic";
import type { Nyc311OperatorProjectionsTopic } from "./Nyc311OperatorProjectionsTopic";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";
import { Nyc311Function } from "./Nyc311Function";

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
export class Nyc311OperatorsStreamFanOutLambda extends Nyc311Function {
  public readonly fanOutLogGroup: logs.LogGroup;
  public readonly onFailureDeadLetterQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: Nyc311OperatorsStreamFanOutLambdaProps) {
    const suffix = ENV_NAME_SUFFIX[props.envName];

    super(scope, id, {
      envName: props.envName,
      name: "Nyc311OperatorsStreamFanOut",
      entry: ["controller", "ingestion", "fanOutOperatorEventsController.ts"],
      handler: "fanOutOperatorEventsController",
      timeout: Duration.seconds(30),
      memorySize: 256,
      environment: {
        OPERATOR_EVENTS_TOPIC_ARN: props.operatorEventsTopic.topic.topicArn,
        OPERATOR_PROJECTIONS_TOPIC_ARN: props.operatorProjectionsTopic.topic.topicArn,
      },
    });

    this.fanOutLogGroup = this.functionLogGroup;

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
