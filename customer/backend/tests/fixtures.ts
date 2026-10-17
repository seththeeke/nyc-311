import type { BureauWebhookEvent } from "../models/bureauWebhookEvent";
import type { WebhookCustomerFacingOrder } from "../models/webhookCustomerFacingOrder";

/* Shared across the customer package's tests. */

/* `whsec_` + base64 of 32 bytes, the Standard Webhooks secret format. */
export const SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSwMfKQ9r8GKYo=";

export const acceptedEvent: BureauWebhookEvent = {
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

export const resolvedEvent: BureauWebhookEvent = {
  type: "ORDER_RESOLVED",
  timestamp: "2026-10-11T09:27:40.000Z",
  data: { ...acceptedEvent.data, resolved_at: "2026-10-11T09:27:40.000Z" },
};

export const openOrder: WebhookCustomerFacingOrder = {
  order_id: "01ORDER",
  status: "OPEN",
  request_id: "01REQUEST",
  external_unique_key: "69860415",
  complaint_type: "Street Condition",
  descriptor: "Pothole",
  borough: "BROOKLYN",
  address: "412 ATLANTIC AVENUE",
  zip: "11217",
  reported_at: "2026-10-09T22:41:00.000",
  accepted_at: "2026-10-10T14:03:11.000Z",
  resolved_at: null,
  last_webhook_id: "evt_01ORDER_1",
  updated_at: "2026-10-10T14:03:12.000Z",
};
