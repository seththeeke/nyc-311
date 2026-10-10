import type { Context, SQSBatchResponse } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { ValidationError } from "../../models/errors";
import { SqsEventSchema, type SqsRecord } from "../../models/sqsEvent";
import { WebhookDeliveryTaskSchema } from "../../models/webhookDeliveryTask";
import { deliverWebhook } from "../../service/webhook/webhookDeliveryService";

/**
 * Entry point for the webhook delivery Lambda
 * (`13-customer-simulation.md` §3 Flow A) — consumes the delivery queue,
 * one signed POST per message. A failed delivery is reported per item and
 * left on the queue; the queue's visibility timeout and `maxReceiveCount`
 * are the whole retry policy.
 */
export const deliverWebhookController = async (event: unknown, context: Context): Promise<SQSBatchResponse> => {
  logInfo("DeliverWebhookControllerInvoked", { event, awsRequestId: context.awsRequestId });

  const parsed = SqsEventSchema.safeParse(event);
  if (!parsed.success) {
    throw new ValidationError("SQS event failed validation", parsed.error.issues);
  }

  const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];
  for (const record of parsed.data.Records) {
    try {
      await deliverOne(record);
    } catch (err) {
      logError("DeliverWebhookControllerRecordFailed", {
        messageId: record.messageId,
        error: err instanceof Error ? err.message : err,
        awsRequestId: context.awsRequestId,
      });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  const response: SQSBatchResponse = { batchItemFailures };
  logInfo("DeliverWebhookControllerCompleted", {
    recordCount: parsed.data.Records.length,
    failureCount: batchItemFailures.length,
    response,
    awsRequestId: context.awsRequestId,
  });
  return response;
};

async function deliverOne(record: SqsRecord): Promise<void> {
  const body: unknown = JSON.parse(record.body);
  const parsedTask = WebhookDeliveryTaskSchema.safeParse(body);
  if (!parsedTask.success) {
    throw new ValidationError("SQS message body failed WebhookDeliveryTask validation", parsedTask.error.issues);
  }
  /* SQS counts receives from 1; a hand-built event without attributes logs as attempt 1. */
  const attempt = Number(record.attributes?.["ApproximateReceiveCount"] ?? "1");
  await deliverWebhook(parsedTask.data, attempt);
}
