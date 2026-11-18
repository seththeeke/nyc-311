import { Duration } from "aws-cdk-lib";
import { StartingPosition } from "aws-cdk-lib/aws-lambda";
import { DynamoEventSource, SqsDlq } from "aws-cdk-lib/aws-lambda-event-sources";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";
import type { OrdersTable } from "../data/OrdersTable";
import type { Nyc311OrderEventsTopic } from "./Nyc311OrderEventsTopic";
import type { Nyc311OrderProjectionsTopic } from "./Nyc311OrderProjectionsTopic";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";
import { Nyc311Function } from "./Nyc311Function";

export interface Nyc311OrdersStreamFanOutLambdaProps {
  envName: Nyc311Environment;
  ordersTable: OrdersTable;
  orderEventsTopic: Nyc311OrderEventsTopic;
  orderProjectionsTopic: Nyc311OrderProjectionsTopic;
}

/*
 * 7-data-warehousing.md §4 — same numbers as the Requests-side fan-out,
 * no reason to invent new ones: batchSize 100 drains a full burst in a
 * bounded number of invocations, per-item failure isolation
 * (reportBatchItemFailures) keeps that larger blast radius from being a
 * correctness problem.
 */
const BATCH_SIZE = 100;
const RETRY_ATTEMPTS = 3;

/**
 * The `Orders` table's sole DynamoDB Stream consumer (`7-data-warehousing.md`
 * §4, renamed from `Nyc311OrderEventFanOutLambda`). Routes each record by
 * its `sk`: an `EVENT#` item to {@link Nyc311OrderEventsTopic} (unchanged,
 * feeds Order-evaluation), a `#METADATA` change to
 * {@link Nyc311OrderProjectionsTopic} (feeds the warehouse). Two outbound
 * topics, no DAO calls.
 */
export class Nyc311OrdersStreamFanOutLambda extends Nyc311Function {
  public readonly fanOutLogGroup: logs.LogGroup;
  public readonly onFailureDeadLetterQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: Nyc311OrdersStreamFanOutLambdaProps) {
    const suffix = ENV_NAME_SUFFIX[props.envName];

    super(scope, id, {
      envName: props.envName,
      name: "Nyc311OrdersStreamFanOut",
      entry: ["controller", "order-processing", "fanOutOrdersStreamController.ts"],
      handler: "fanOutOrdersStreamController",
      timeout: Duration.seconds(30),
      memorySize: 256,
      environment: {
        ORDER_EVENTS_TOPIC_ARN: props.orderEventsTopic.topic.topicArn,
        ORDER_PROJECTIONS_TOPIC_ARN: props.orderProjectionsTopic.topic.topicArn,
      },
    });

    this.fanOutLogGroup = this.functionLogGroup;

    /*
     * Same known asymmetry as the Requests-side fan-out: this on-failure
     * destination only ever carries stream metadata for a failed batch,
     * never the actual record content — accepted for consistency with
     * established precedent.
     */
    this.onFailureDeadLetterQueue = new sqs.Queue(this, "OnFailureDlq", {
      queueName: `Nyc311OrdersStreamFanOutDlq-${suffix}`,
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
        /* No FilterCriteria — relevance filtering happens inside the handler. */
      })
    );

    /*
     * Least privilege: this Lambda only ever publishes — it never reads
     * from or writes to Orders (`7-data-warehousing.md` §4/§15).
     */
    props.orderEventsTopic.topic.grantPublish(this);
    props.orderProjectionsTopic.topic.grantPublish(this);
  }
}
