import type { Context, DynamoDBBatchResponse } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { fanOutRequestRecord } from "../../service/orderIngestion/requestFanOutService";
import { RequestStreamEventSchema } from "../../models/requestStreamEvent";
import { ValidationError } from "../../models/errors";

/**
 * Entry point for the `Requests` table's DynamoDB Streams fan-out Lambda —
 * `3-order-ingestion.md` §2's "listener," invoked directly by an event
 * source mapping (no Step Functions/API Gateway envelope). Validates the
 * raw stream event into a structured model first (CLAUDE.md §5.2), then
 * delegates each record to `service/orderIngestion/requestFanOutService`.
 *
 * Never touches a DAO (there isn't one for this Lambda — §2.2) and never
 * applies filter/promotion logic itself; its only job is deciding which
 * records are worth publishing and publishing them.
 *
 * Reports per-item failures (`reportBatchItemFailures`, §2.3) so one bad
 * record's `SequenceNumber` is retried on its own — one record failing
 * never blocks or retries the rest of the batch.
 */
export const fanOutRequestEventsController = async (
  event: unknown,
  context: Context
): Promise<DynamoDBBatchResponse> => {
  logInfo("FanOutRequestEventsControllerInvoked", { event, awsRequestId: context.awsRequestId });

  const parsed = RequestStreamEventSchema.safeParse(event);
  if (!parsed.success) {
    throw new ValidationError("Request stream event failed validation", parsed.error.issues);
  }

  const batchItemFailures: DynamoDBBatchResponse["batchItemFailures"] = [];
  for (const record of parsed.data.Records) {
    try {
      await fanOutRequestRecord(record);
    } catch (err) {
      logError("FanOutRequestEventsControllerRecordFailed", {
        sequenceNumber: record.dynamodb.SequenceNumber,
        error: err instanceof Error ? err.message : err,
        awsRequestId: context.awsRequestId,
      });
      batchItemFailures.push({ itemIdentifier: record.dynamodb.SequenceNumber });
    }
  }

  const response: DynamoDBBatchResponse = { batchItemFailures };
  logInfo("FanOutRequestEventsControllerCompleted", {
    recordCount: parsed.data.Records.length,
    failureCount: batchItemFailures.length,
    response,
    awsRequestId: context.awsRequestId,
  });
  return response;
};
