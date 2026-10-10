import { describe, expect, it } from "vitest";
import { WebhookSinkDeliverySchema } from "../../models/webhookSinkDelivery";

describe("WebhookSinkDeliverySchema", () => {
  it("accepts a record, with or without a readable event type", () => {
    const delivery = { webhook_id: "evt_1", event_type: "ORDER_ACCEPTED", received_at: "2026-10-10T14:03:12.000Z", signature_valid: true, expires_at: 1791000000 };
    expect(WebhookSinkDeliverySchema.safeParse(delivery).success).toBe(true);
    expect(WebhookSinkDeliverySchema.safeParse({ ...delivery, event_type: null }).success).toBe(true);
    expect(WebhookSinkDeliverySchema.safeParse({ ...delivery, expires_at: 0 }).success).toBe(false);
  });
});
