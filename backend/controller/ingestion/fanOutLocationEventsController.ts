import type { Context, DynamoDBBatchResponse } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { fanOutLocationRecord } from "../../service/ingestion/locationEventService";
import { LocationStreamEventSchema } from "../../models/locationStreamEvent";
import { ValidationError } from "../../models/errors";

/**
 * The `Locations` stream's fan-out Lambda entry point
 * (`7-data-warehousing.md` §4). Validates the raw event, delegates each
 * record to `locationEventService`, and reports per-item failures so one
 * bad `SequenceNumber` never blocks the rest of the batch.
 */
export const fanOutLocationEventsController = async (
  event: unknown,
  context: Context
): Promise<DynamoDBBatchResponse> => {
  logInfo("FanOutLocationEventsControllerInvoked", { event, awsRequestId: context.awsRequestId });

  const parsed = LocationStreamEventSchema.safeParse(event);
  if (!parsed.success) {
    throw new ValidationError("Location stream event failed validation", parsed.error.issues);
  }

  const batchItemFailures: DynamoDBBatchResponse["batchItemFailures"] = [];
  for (const record of parsed.data.Records) {
    try {
      await fanOutLocationRecord(record);
    } catch (err) {
      logError("FanOutLocationEventsControllerRecordFailed", {
        sequenceNumber: record.dynamodb.SequenceNumber,
        error: err instanceof Error ? err.message : err,
        awsRequestId: context.awsRequestId,
      });
      batchItemFailures.push({ itemIdentifier: record.dynamodb.SequenceNumber });
    }
  }

  const response: DynamoDBBatchResponse = { batchItemFailures };
  logInfo("FanOutLocationEventsControllerCompleted", {
    recordCount: parsed.data.Records.length,
    failureCount: batchItemFailures.length,
    response,
    awsRequestId: context.awsRequestId,
  });
  return response;
};
