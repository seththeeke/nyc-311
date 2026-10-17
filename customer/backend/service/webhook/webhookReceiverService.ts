import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { requireEnv } from "../../env";
import { logInfo, logWarn } from "../../logger";
import { WebhookCustomerFacingOrderDao } from "../../dao/webhookCustomerFacingOrder/webhookCustomerFacingOrderDao";
import {
  BUREAU_ORDER_ACCEPTED,
  BUREAU_ORDER_RESOLVED,
  BureauWebhookEventSchema,
  type BureauWebhookEvent,
} from "../../models/bureauWebhookEvent";
import { UnauthorizedError, ValidationError } from "../../models/errors";
import type { WebhookCustomerFacingOrder } from "../../models/webhookCustomerFacingOrder";
import { SigningSecretStore } from "./signingSecretStore";
import { WEBHOOK_ID_HEADER, verifyWebhook } from "./webhookSignature";

/* Constructed lazily (CLAUDE.md §5.2) — never a module-scope singleton. */
function getWebhookCustomerFacingOrderDao(): WebhookCustomerFacingOrderDao {
  return new WebhookCustomerFacingOrderDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), requireEnv("CUSTOMER_ORDERS_TABLE_NAME"));
}

export interface WebhookReceiverDeps {
  webhookCustomerFacingOrderDao?: WebhookCustomerFacingOrderDao;
  secretStore?: SigningSecretStore;
  now?: () => Date;
}

/** What one delivery did to the customer's view of its orders. */
export type WebhookReceiptOutcome = "OPENED" | "ALREADY_KNOWN" | "CLOSED" | "IGNORED";

function toOrder(event: BureauWebhookEvent, webhookId: string, now: Date): WebhookCustomerFacingOrder {
  const { data } = event;
  const closed = event.type === BUREAU_ORDER_RESOLVED;
  /* A resolve with no resolved_at still closes the order, at the event's own time. */
  const resolvedAt = closed ? (data.resolved_at ?? event.timestamp) : null;
  return {
    order_id: data.order_id,
    status: closed ? "CLOSED" : "OPEN",
    request_id: data.request_id,
    external_unique_key: data.external_unique_key,
    complaint_type: data.complaint_type,
    descriptor: data.descriptor,
    borough: data.borough,
    address: data.address,
    zip: data.zip,
    reported_at: data.reported_at,
    accepted_at: data.accepted_at,
    resolved_at: resolvedAt,
    last_webhook_id: webhookId,
    updated_at: now.toISOString(),
  };
}

/**
 * Handles one delivery from the bureau: verify the signature against the
 * customer's own secret, read the payload, and open or close the order.
 * Repeats and out-of-order arrivals are harmless.
 *
 * @param headers - Request headers with lowercase names.
 * @param body - The exact request body.
 * @throws {@link UnauthorizedError} if the signature does not verify.
 * @throws {@link ValidationError} if the body is not a readable event.
 */
export async function receiveBureauWebhook(
  headers: Record<string, string | undefined>,
  body: string,
  deps: WebhookReceiverDeps = {}
): Promise<WebhookReceiptOutcome> {
  const now = (deps.now ?? (() => new Date()))();
  const webhookId = headers[WEBHOOK_ID_HEADER];
  const secret = await (deps.secretStore ?? new SigningSecretStore()).getSecret(requireEnv("CUSTOMER_SIGNING_SECRET_PARAMETER_NAME"));
  if (!webhookId || !verifyWebhook({ secret, headers, body, now })) {
    logWarn("BureauWebhookSignatureRejected", { webhookId: webhookId ?? null });
    throw new UnauthorizedError("Invalid webhook signature");
  }

  let rawEvent: unknown;
  try {
    rawEvent = JSON.parse(body);
  } catch {
    logWarn("BureauWebhookBodyNotJson", { webhookId });
    throw new ValidationError("Webhook body is not JSON");
  }
  const parsed = BureauWebhookEventSchema.safeParse(rawEvent);
  if (!parsed.success) {
    logWarn("BureauWebhookBodyInvalid", { webhookId, issues: parsed.error.issues });
    throw new ValidationError("Webhook body failed validation", parsed.error.issues);
  }
  const event = parsed.data;
  const context = { webhookId, eventType: event.type, orderId: event.data.order_id };
  logInfo("BureauWebhookVerified", context);

  if (event.type !== BUREAU_ORDER_ACCEPTED && event.type !== BUREAU_ORDER_RESOLVED) {
    /* Acknowledged, not rejected: refusing it would only make the bureau retry for a day. */
    logWarn("BureauWebhookEventTypeIgnored", context);
    return "IGNORED";
  }

  const dao = deps.webhookCustomerFacingOrderDao ?? getWebhookCustomerFacingOrderDao();
  const order = toOrder(event, webhookId, now);
  if (order.status === "CLOSED") {
    await dao.closeOrder(order);
    logInfo("CustomerOrderClosed", context);
    return "CLOSED";
  }
  const opened = await dao.openOrder(order);
  logInfo(opened ? "CustomerOrderOpened" : "CustomerOrderAlreadyKnown", context);
  return opened ? "OPENED" : "ALREADY_KNOWN";
}
