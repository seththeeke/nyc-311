import type { Context, DynamoDBBatchResponse } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { fanOutRequestRecord } from "../../service/ingestion/nyc311RequestService";
import { RequestStreamEventSchema } from "../../models/requestStreamEvent";
import { ValidationError } from "../../models/errors";

/**
 * The `Requests` stream's fan-out Lambda entry point (`3-order-ingestion.md`
 * §2). Validates the raw event, delegates each record to
 * `nyc311RequestService`, and reports per-item failures so one bad
 * `SequenceNumber` never blocks the rest of the batch.
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
