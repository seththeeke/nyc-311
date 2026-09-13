import type { Context, DynamoDBBatchResponse } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { fanOutOperatorRecord } from "../../service/ingestion/operatorEventService";
import { OperatorStreamEventSchema } from "../../models/operatorStreamEvent";
import { ValidationError } from "../../models/errors";

/**
 * The `Operators` stream's fan-out Lambda entry point
 * (`7-data-warehousing.md` §4, Leg 6). Validates the raw event, delegates
 * each record to `operatorEventService` (which routes `EVENT#` items to
 * `Nyc311OperatorEventsTopic` and `#METADATA` changes to
 * `Nyc311OperatorProjectionsTopic`), and reports per-item failures so one
 * bad `SequenceNumber` never blocks the rest of the batch.
 */
export const fanOutOperatorEventsController = async (
  event: unknown,
  context: Context
): Promise<DynamoDBBatchResponse> => {
  logInfo("FanOutOperatorEventsControllerInvoked", { event, awsRequestId: context.awsRequestId });

  const parsed = OperatorStreamEventSchema.safeParse(event);
  if (!parsed.success) {
    throw new ValidationError("Operator stream event failed validation", parsed.error.issues);
  }

  const batchItemFailures: DynamoDBBatchResponse["batchItemFailures"] = [];
  for (const record of parsed.data.Records) {
    try {
      await fanOutOperatorRecord(record);
    } catch (err) {
      logError("FanOutOperatorEventsControllerRecordFailed", {
        sequenceNumber: record.dynamodb.SequenceNumber,
        error: err instanceof Error ? err.message : err,
        awsRequestId: context.awsRequestId,
      });
      batchItemFailures.push({ itemIdentifier: record.dynamodb.SequenceNumber });
    }
  }

  const response: DynamoDBBatchResponse = { batchItemFailures };
  logInfo("FanOutOperatorEventsControllerCompleted", {
    recordCount: parsed.data.Records.length,
    failureCount: batchItemFailures.length,
    response,
    awsRequestId: context.awsRequestId,
  });
  return response;
};
