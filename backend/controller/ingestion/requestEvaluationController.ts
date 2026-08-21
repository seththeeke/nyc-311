import type { Context, SQSBatchResponse } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { evaluateRequest } from "../../service/ingestion/requestEvaluationService";
import { SqsEventSchema, type SqsRecord } from "../../models/sqsEvent";
import { RequestSchema } from "../../models/request";
import { ValidationError } from "../../models/errors";

/**
 * Entry point for the request-processor Lambda — consumes from
 * `Nyc311OrderIngestionQueue` (`3-order-ingestion.md` §2/§3), the queue the
 * fan-out Lambda publishes onto. Validates the SQS event, parses each
 * message body as a `Request`, and delegates to `evaluateRequest`.
 * Per-item failure reporting, same shape as `fanOutRequestEventsController`.
 */
export const requestEvaluationController = async (event: unknown, context: Context): Promise<SQSBatchResponse> => {
  logInfo("RequestEvaluationControllerInvoked", { event, awsRequestId: context.awsRequestId });

  const parsed = SqsEventSchema.safeParse(event);
  if (!parsed.success) {
    throw new ValidationError("SQS event failed validation", parsed.error.issues);
  }

  const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];
  for (const record of parsed.data.Records) {
    try {
      await evaluateRecord(record);
    } catch (err) {
      logError("RequestEvaluationControllerRecordFailed", {
        messageId: record.messageId,
        error: err instanceof Error ? err.message : err,
        awsRequestId: context.awsRequestId,
      });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  const response: SQSBatchResponse = { batchItemFailures };
  logInfo("RequestEvaluationControllerCompleted", {
    recordCount: parsed.data.Records.length,
    failureCount: batchItemFailures.length,
    response,
    awsRequestId: context.awsRequestId,
  });
  return response;
};

async function evaluateRecord(record: SqsRecord): Promise<void> {
  const body: unknown = JSON.parse(record.body);
  const parsedRequest = RequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    throw new ValidationError("SQS message body failed Request validation", parsedRequest.error.issues);
  }
  await evaluateRequest(parsedRequest.data);
}
