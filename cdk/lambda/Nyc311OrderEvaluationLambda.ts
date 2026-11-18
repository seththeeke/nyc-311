import { Duration } from "aws-cdk-lib";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { OrdersTable } from "../data/OrdersTable";
import type { Nyc311OrderEvaluationQueue } from "./Nyc311OrderEvaluationQueue";
import type { Nyc311Environment } from "../stack/Nyc311Stack";
import { Nyc311Function } from "./Nyc311Function";

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
export class Nyc311OrderEvaluationLambda extends Nyc311Function {
  public readonly orderEvaluationLogGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: Nyc311OrderEvaluationLambdaProps) {
    super(scope, id, {
      envName: props.envName,
      name: "Nyc311OrderEvaluation",
      entry: ["controller", "order-processing", "evaluateOrderController.ts"],
      handler: "evaluateOrderController",
      timeout: Duration.seconds(30),
      memorySize: 256,
      environment: {
        ORDERS_TABLE_NAME: props.ordersTable.tableName,
      },
    });

    this.orderEvaluationLogGroup = this.functionLogGroup;

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
