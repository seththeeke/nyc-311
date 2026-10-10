import type { OrderEvent, OrderEventType } from "../../../models/order";
import type { WebhookEvent } from "../../../models/webhookEvent";
import type { WebhookSubscription } from "../../../models/webhookSubscription";

/* Shared across the webhook service, DAO and controller tests. */

/* `whsec_` + base64 of 32 bytes, the Standard Webhooks secret format. */
export const SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSwMfKQ9r8GKYo=";

export const subscription: WebhookSubscription = {
  subscription_id: "01SUB",
  name: "the-customer",
  callback_url: "https://customer-api.boroughsim.com/webhooks/bureau",
  event_types: ["ORDER_ACCEPTED", "ORDER_RESOLVED"],
  status: "ACTIVE",
  secret_parameter_name: "/nyc311/test/webhook/01SUB/secret",
  version: 1,
  created_at: "2026-10-10T14:00:00.000Z",
  updated_at: "2026-10-10T14:00:00.000Z",
};

export const webhookEvent: WebhookEvent = {
  type: "ORDER_ACCEPTED",
  timestamp: "2026-10-10T14:03:11.000Z",
  data: {
    order_id: "01ORDER",
    request_id: "01REQUEST",
    external_unique_key: "69860415",
    complaint_type: "Street Condition",
    descriptor: "Pothole",
    borough: "BROOKLYN",
    address: "412 ATLANTIC AVENUE",
    zip: "11217",
    reported_at: "2026-10-09T22:41:00.000",
    accepted_at: "2026-10-10T14:03:11.000Z",
  },
};

export function orderEvent(eventType: OrderEventType, sequence: number, occurredAt: string): OrderEvent {
  return {
    order_id: "01ORDER",
    sequence_number: sequence,
    event_type: eventType,
    stage: null,
    payload: {},
    occurred_at: occurredAt,
    actor: "SYSTEM",
  };
}
