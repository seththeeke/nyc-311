import type { Context, SQSBatchResponse } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { recordWorkspaceMetricEvent } from "../../service/analytics/liveWorkspaceMetricsService";
import { SqsEventSchema, type SqsRecord } from "../../models/sqsEvent";
import { OrderEventSchema } from "../../models/order";
import { ValidationError } from "../../models/errors";

/**
 * Entry point for the live-workspace-metrics Lambda — consumes from
 * `Nyc311LiveWorkspaceMetricsQueue`, the filtered subscription that only
 * delivers `ORDER_ACCEPTED` and `ORDER_RESOLVED` events. Raw SNS delivery,
 * so each body is the plain `OrderEvent` JSON. Validates, then delegates
 * each record to `recordWorkspaceMetricEvent`; a failed record is
 * reported per item so the rest of the batch still lands.
 */
export const recordWorkspaceMetricsController = async (event: unknown, context: Context): Promise<SQSBatchResponse> => {
  logInfo("RecordWorkspaceMetricsControllerInvoked", { event, awsRequestId: context.awsRequestId });

  const parsed = SqsEventSchema.safeParse(event);
  if (!parsed.success) {
    throw new ValidationError("SQS event failed validation", parsed.error.issues);
  }

  const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];
  for (const record of parsed.data.Records) {
    try {
      await recordOne(record);
    } catch (err) {
      logError("RecordWorkspaceMetricsControllerRecordFailed", {
        messageId: record.messageId,
        error: err instanceof Error ? err.message : err,
        awsRequestId: context.awsRequestId,
      });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  const response: SQSBatchResponse = { batchItemFailures };
  logInfo("RecordWorkspaceMetricsControllerCompleted", {
    recordCount: parsed.data.Records.length,
    failureCount: batchItemFailures.length,
    response,
    awsRequestId: context.awsRequestId,
  });
  return response;
};

async function recordOne(record: SqsRecord): Promise<void> {
  const body: unknown = JSON.parse(record.body);
  const parsedOrderEvent = OrderEventSchema.safeParse(body);
  if (!parsedOrderEvent.success) {
    throw new ValidationError("SQS message body failed OrderEvent validation", parsedOrderEvent.error.issues);
  }
  await recordWorkspaceMetricEvent(parsedOrderEvent.data);
}
