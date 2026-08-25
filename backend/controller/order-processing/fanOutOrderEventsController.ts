import type { Context, DynamoDBBatchResponse } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { fanOutOrderEvent } from "../../service/order/orderEvaluationService";
import { OrderStreamEventSchema } from "../../models/orderStreamEvent";
import { ValidationError } from "../../models/errors";

/**
 * The `Orders` stream's fan-out Lambda entry point (`5-order-evaluation.md`
 * §3). Validates the raw event, delegates each record to
 * `orderEvaluationService`, and reports per-item failures so one bad
 * `SequenceNumber` never blocks the rest of the batch.
 */
export const fanOutOrderEventsController = async (
  event: unknown,
  context: Context
): Promise<DynamoDBBatchResponse> => {
  logInfo("FanOutOrderEventsControllerInvoked", { event, awsRequestId: context.awsRequestId });

  const parsed = OrderStreamEventSchema.safeParse(event);
  if (!parsed.success) {
    throw new ValidationError("Order stream event failed validation", parsed.error.issues);
  }

  const batchItemFailures: DynamoDBBatchResponse["batchItemFailures"] = [];
  for (const record of parsed.data.Records) {
    try {
      await fanOutOrderEvent(record);
    } catch (err) {
      logError("FanOutOrderEventsControllerRecordFailed", {
        sequenceNumber: record.dynamodb.SequenceNumber,
        error: err instanceof Error ? err.message : err,
        awsRequestId: context.awsRequestId,
      });
      batchItemFailures.push({ itemIdentifier: record.dynamodb.SequenceNumber });
    }
  }

  const response: DynamoDBBatchResponse = { batchItemFailures };
  logInfo("FanOutOrderEventsControllerCompleted", {
    recordCount: parsed.data.Records.length,
    failureCount: batchItemFailures.length,
    response,
    awsRequestId: context.awsRequestId,
  });
  return response;
};
