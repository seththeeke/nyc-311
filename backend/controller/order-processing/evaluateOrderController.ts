import type { Context, SQSBatchResponse } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { evaluateOrder } from "../../service/order/orderEvaluationService";
import { SqsEventSchema, type SqsRecord } from "../../models/sqsEvent";
import { OrderEventSchema } from "../../models/order";
import { ValidationError } from "../../models/errors";

/**
 * Entry point for the order-evaluation Lambda — consumes from
 * `Nyc311OrderEvaluationQueue` (`5-order-evaluation.md` §3/§6), the
 * filtered subscription that only ever delivers `ORDER_CREATED` events.
 * Raw SNS delivery, so each message body is the plain `OrderEvent` JSON
 * the fan-out Lambda published, no envelope to unwrap. Validates the
 * event and delegates each record to `evaluateOrder`, same per-item
 * failure shape as every other queue-triggered controller here.
 */
export const evaluateOrderController = async (event: unknown, context: Context): Promise<SQSBatchResponse> => {
  logInfo("EvaluateOrderControllerInvoked", { event, awsRequestId: context.awsRequestId });

  const parsed = SqsEventSchema.safeParse(event);
  if (!parsed.success) {
    throw new ValidationError("SQS event failed validation", parsed.error.issues);
  }

  const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];
  for (const record of parsed.data.Records) {
    try {
      await evaluateRecord(record);
    } catch (err) {
      logError("EvaluateOrderControllerRecordFailed", {
        messageId: record.messageId,
        error: err instanceof Error ? err.message : err,
        awsRequestId: context.awsRequestId,
      });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  const response: SQSBatchResponse = { batchItemFailures };
  logInfo("EvaluateOrderControllerCompleted", {
    recordCount: parsed.data.Records.length,
    failureCount: batchItemFailures.length,
    response,
    awsRequestId: context.awsRequestId,
  });
  return response;
};

async function evaluateRecord(record: SqsRecord): Promise<void> {
  const body: unknown = JSON.parse(record.body);
  const parsedOrderEvent = OrderEventSchema.safeParse(body);
  if (!parsedOrderEvent.success) {
    throw new ValidationError("SQS message body failed OrderEvent validation", parsedOrderEvent.error.issues);
  }
  await evaluateOrder(parsedOrderEvent.data);
}
