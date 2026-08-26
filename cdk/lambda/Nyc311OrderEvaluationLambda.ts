import * as path from "node:path";
import { Duration } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { OrdersTable } from "../data/OrdersTable";
import type { Nyc311OrderEvaluationQueue } from "./Nyc311OrderEvaluationQueue";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311OrderEvaluationLambdaProps {
  envName: Nyc311Environment;
  ordersTable: OrdersTable;
  orderEvaluationQueue: Nyc311OrderEvaluationQueue;
}

/* Same reasoning as Nyc311RequestEvaluationLambda — real DB work per message, not a single publish. */
const BATCH_SIZE = 10;

/**
 * The order-evaluation Lambda (`5-order-evaluation.md` §1-§6) — consumes
 * from {@link Nyc311OrderEvaluationQueue}, runs `evaluateOrder`'s
 * idempotency check and the mocked accept/reject/case rule, and writes the
 * outcome back onto the Order. Retry/DLQ is the queue's own redrive
 * policy — no separate destination needed, same reasoning as
 * `Nyc311RequestEvaluationLambda`.
 */
export class Nyc311OrderEvaluationLambda extends NodejsFunction {
  public readonly orderEvaluationLogGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: Nyc311OrderEvaluationLambdaProps) {
    const suffix = ENV_NAME_SUFFIX[props.envName];
    const functionName = `Nyc311OrderEvaluation-${suffix}`;

    const orderEvaluationLogGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "order-processing", "evaluateOrderController.ts"),
      handler: "evaluateOrderController",
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(30),
      memorySize: 256,
      logGroup: orderEvaluationLogGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        ORDERS_TABLE_NAME: props.ordersTable.tableName,
      },
    });

    this.orderEvaluationLogGroup = orderEvaluationLogGroup;

    this.addEventSource(
      new SqsEventSource(props.orderEvaluationQueue.queue, {
        batchSize: BATCH_SIZE,
        reportBatchItemFailures: true,
      })
    );

    /* Least privilege: getOrder (GetItem) + accept/reject/case (TransactWriteItems, needs Put). */
    props.ordersTable.grant(this, "dynamodb:GetItem", "dynamodb:PutItem");
  }
}
