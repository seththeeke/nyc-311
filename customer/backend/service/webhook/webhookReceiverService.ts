import { createDocumentClient } from "../../dynamoClient";
import { requireEnv } from "../../env";
import { logInfo, logWarn } from "../../logger";
import { WebhookCustomerFacingOrderDao } from "../../dao/webhookCustomerFacingOrder/webhookCustomerFacingOrderDao";
import {
  BOROUGHSIM_ORDER_ACCEPTED,
  BOROUGHSIM_ORDER_RESOLVED,
  BoroughSimWebhookEventSchema,
  type BoroughSimWebhookEvent,
} from "../../models/boroughSimWebhookEvent";
import { UnauthorizedError, ValidationError } from "../../models/errors";
import type { WebhookCustomerFacingOrder } from "../../models/webhookCustomerFacingOrder";
import { newPickKey } from "../idea/ulid";
import { SigningSecretStore } from "./signingSecretStore";
import { WEBHOOK_ID_HEADER, verifyWebhook } from "./webhookSignature";

/* Constructed lazily (CLAUDE.md §5.2) — never a module-scope singleton. */
function getWebhookCustomerFacingOrderDao(): WebhookCustomerFacingOrderDao {
  return new WebhookCustomerFacingOrderDao(createDocumentClient(), requireEnv("CUSTOMER_ORDERS_TABLE_NAME"));
}

export interface WebhookReceiverDeps {
  webhookCustomerFacingOrderDao?: WebhookCustomerFacingOrderDao;
  secretStore?: SigningSecretStore;
  now?: () => Date;
  pickKey?: () => string;
}

/** What one delivery did to the customer's view of its orders. */
export type WebhookReceiptOutcome = "OPENED" | "ALREADY_KNOWN" | "CLOSED" | "IGNORED";

function toOrder(event: BoroughSimWebhookEvent, webhookId: string, now: Date, pickKey: () => string): WebhookCustomerFacingOrder {
  const { data } = event;
  const closed = event.type === BOROUGHSIM_ORDER_RESOLVED;
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
    /* Sampling keys only while open, so the OpenByBorough index holds open orders only; a close drops them. */
    ...(!closed && data.borough ? { open_borough: data.borough, pick_key: pickKey() } : {}),
  };
}

/**
 * Handles one delivery from BoroughSim: verify the signature against the
 * customer's own secret, read the payload, and open or close the order.
 * Repeats and out-of-order arrivals are harmless.
 *
 * @param headers - Request headers with lowercase names.
 * @param body - The exact request body.
 * @throws {@link UnauthorizedError} if the signature does not verify.
 * @throws {@link ValidationError} if the body is not a readable event.
 */
export async function receiveBoroughSimWebhook(
  headers: Record<string, string | undefined>,
  body: string,
  deps: WebhookReceiverDeps = {}
): Promise<WebhookReceiptOutcome> {
  const now = (deps.now ?? (() => new Date()))();
  const webhookId = headers[WEBHOOK_ID_HEADER];
  const secret = await (deps.secretStore ?? new SigningSecretStore()).getSecret(requireEnv("CUSTOMER_SIGNING_SECRET_PARAMETER_NAME"));
  if (!webhookId || !verifyWebhook({ secret, headers, body, now })) {
    logWarn("BoroughSimWebhookSignatureRejected", { webhookId: webhookId ?? null });
    throw new UnauthorizedError("Invalid webhook signature");
  }

  let rawEvent: unknown;
  try {
    rawEvent = JSON.parse(body);
  } catch {
    logWarn("BoroughSimWebhookBodyNotJson", { webhookId });
    throw new ValidationError("Webhook body is not JSON");
  }
  const parsed = BoroughSimWebhookEventSchema.safeParse(rawEvent);
  if (!parsed.success) {
    logWarn("BoroughSimWebhookBodyInvalid", { webhookId, issues: parsed.error.issues });
    throw new ValidationError("Webhook body failed validation", parsed.error.issues);
  }
  const event = parsed.data;
  const context = { webhookId, eventType: event.type, orderId: event.data.order_id };
  logInfo("BoroughSimWebhookVerified", context);

  if (event.type !== BOROUGHSIM_ORDER_ACCEPTED && event.type !== BOROUGHSIM_ORDER_RESOLVED) {
    /* Acknowledged, not rejected: refusing it would only make BoroughSim retry for a day. */
    logWarn("BoroughSimWebhookEventTypeIgnored", context);
    return "IGNORED";
  }

  const dao = deps.webhookCustomerFacingOrderDao ?? getWebhookCustomerFacingOrderDao();
  const order = toOrder(event, webhookId, now, deps.pickKey ?? (() => newPickKey()));
  if (order.status === "CLOSED") {
    await dao.closeOrder(order);
    logInfo("CustomerOrderClosed", context);
    return "CLOSED";
  }
  const opened = await dao.openOrder(order);
  logInfo(opened ? "CustomerOrderOpened" : "CustomerOrderAlreadyKnown", context);
  return opened ? "OPENED" : "ALREADY_KNOWN";
}
