import * as path from "node:path";
import { Duration } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { RequestsTable } from "../data/RequestsTable";
import type { LocationsTable } from "../data/LocationsTable";
import type { OrdersTable } from "../data/OrdersTable";
import type { Nyc311OrderIngestionQueue } from "./Nyc311OrderIngestionQueue";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311RequestEvaluationLambdaProps {
  envName: Nyc311Environment;
  requestsTable: RequestsTable;
  locationsTable: LocationsTable;
  ordersTable: OrdersTable;
  orderIngestionQueue: Nyc311OrderIngestionQueue;
}

/* Smaller than the fan-out leg's batchSize 100 — each message here does real
   DB work (location lookup, an Order-creation transaction), not a single
   publish, so 10 (SQS's own per-batch max without a batching window) keeps
   per-invocation blast radius/duration reasonable. */
const BATCH_SIZE = 10;

/**
 * The request-processor Lambda (`3-order-ingestion.md` §3) — consumes from
 * {@link Nyc311OrderIngestionQueue}, runs `evaluateRequest`'s filter
 * pipeline, and promotes/creates the `Order` on a pass. Retry/DLQ is the
 * queue's own redrive policy (already built) — unlike the fan-out leg's
 * stream `onFailure`, no separate destination is needed here since SQS's
 * redrive-to-DLQ already carries full message content.
 */
export class Nyc311RequestEvaluationLambda extends NodejsFunction {
  public readonly requestEvaluationLogGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: Nyc311RequestEvaluationLambdaProps) {
    const suffix = ENV_NAME_SUFFIX[props.envName];
    const functionName = `Nyc311RequestEvaluation-${suffix}`;

    const requestEvaluationLogGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "ingestion", "requestEvaluationController.ts"),
      handler: "requestEvaluationController",
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(30),
      memorySize: 256,
      logGroup: requestEvaluationLogGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        REQUESTS_TABLE_NAME: props.requestsTable.tableName,
        LOCATIONS_TABLE_NAME: props.locationsTable.tableName,
        ORDERS_TABLE_NAME: props.ordersTable.tableName,
      },
    });

    this.requestEvaluationLogGroup = requestEvaluationLogGroup;

    this.addEventSource(
      new SqsEventSource(props.orderIngestionQueue.queue, {
        batchSize: BATCH_SIZE,
        reportBatchItemFailures: true,
      })
    );

    /* Least privilege: exactly the calls each DAO issues, nothing broader. */
    props.requestsTable.grant(this, "dynamodb:GetItem", "dynamodb:PutItem");
    props.locationsTable.grant(this, "dynamodb:GetItem", "dynamodb:PutItem");
    props.ordersTable.grant(this, "dynamodb:GetItem", "dynamodb:PutItem");
  }
}
