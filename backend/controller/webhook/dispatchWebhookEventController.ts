import type { Context, SQSBatchResponse } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { ValidationError } from "../../models/errors";
import { OrderEventSchema } from "../../models/order";
import { SqsEventSchema, type SqsRecord } from "../../models/sqsEvent";
import { dispatchWebhookEvent } from "../../service/webhook/webhookDispatchService";

/**
 * Entry point for the webhook dispatch Lambda
 * (`13-customer-simulation.md` §3 Flow A) — consumes the dispatch queue,
 * the filtered subscription that only delivers the public catalogue's
 * events. Raw SNS delivery, so each body is the plain `OrderEvent` JSON.
 * A failed record is reported per item so the rest of the batch lands.
 */
export const dispatchWebhookEventController = async (event: unknown, context: Context): Promise<SQSBatchResponse> => {
  logInfo("DispatchWebhookEventControllerInvoked", { event, awsRequestId: context.awsRequestId });

  const parsed = SqsEventSchema.safeParse(event);
  if (!parsed.success) {
    throw new ValidationError("SQS event failed validation", parsed.error.issues);
  }

  const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];
  for (const record of parsed.data.Records) {
    try {
      await dispatchOne(record);
    } catch (err) {
      logError("DispatchWebhookEventControllerRecordFailed", {
        messageId: record.messageId,
        error: err instanceof Error ? err.message : err,
        awsRequestId: context.awsRequestId,
      });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  const response: SQSBatchResponse = { batchItemFailures };
  logInfo("DispatchWebhookEventControllerCompleted", {
    recordCount: parsed.data.Records.length,
    failureCount: batchItemFailures.length,
    response,
    awsRequestId: context.awsRequestId,
  });
  return response;
};

async function dispatchOne(record: SqsRecord): Promise<void> {
  const body: unknown = JSON.parse(record.body);
  const parsedOrderEvent = OrderEventSchema.safeParse(body);
  if (!parsedOrderEvent.success) {
    throw new ValidationError("SQS message body failed OrderEvent validation", parsedOrderEvent.error.issues);
  }
  await dispatchWebhookEvent(parsedOrderEvent.data);
}
