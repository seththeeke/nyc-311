import type { Context, DynamoDBBatchResponse } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { fanOutOrdersStreamRecord } from "../../service/order/orderEvaluationService";
import { OrderStreamEventSchema } from "../../models/orderStreamEvent";
import { ValidationError } from "../../models/errors";

/**
 * The `Orders` stream's fan-out Lambda entry point (`7-data-warehousing.md`
 * §4). Validates the raw event, delegates each record to
 * `orderEvaluationService.fanOutOrdersStreamRecord` (which routes `EVENT#`
 * items to `Nyc311OrderEventsTopic` and `#METADATA` changes to
 * `Nyc311OrderProjectionsTopic`), and reports per-item failures so one
 * bad `SequenceNumber` never blocks the rest of the batch.
 */
export const fanOutOrdersStreamController = async (
  event: unknown,
  context: Context
): Promise<DynamoDBBatchResponse> => {
  logInfo("FanOutOrdersStreamControllerInvoked", { event, awsRequestId: context.awsRequestId });

  const parsed = OrderStreamEventSchema.safeParse(event);
  if (!parsed.success) {
    throw new ValidationError("Order stream event failed validation", parsed.error.issues);
  }

  const batchItemFailures: DynamoDBBatchResponse["batchItemFailures"] = [];
  for (const record of parsed.data.Records) {
    try {
      await fanOutOrdersStreamRecord(record);
    } catch (err) {
      logError("FanOutOrdersStreamControllerRecordFailed", {
        sequenceNumber: record.dynamodb.SequenceNumber,
        error: err instanceof Error ? err.message : err,
        awsRequestId: context.awsRequestId,
      });
      batchItemFailures.push({ itemIdentifier: record.dynamodb.SequenceNumber });
    }
  }

  const response: DynamoDBBatchResponse = { batchItemFailures };
  logInfo("FanOutOrdersStreamControllerCompleted", {
    recordCount: parsed.data.Records.length,
    failureCount: batchItemFailures.length,
    response,
    awsRequestId: context.awsRequestId,
  });
  return response;
};
