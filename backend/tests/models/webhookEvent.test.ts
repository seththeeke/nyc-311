import { describe, expect, it } from "vitest";
import { WebhookEventSchema } from "../../models/webhookEvent";
import { webhookEvent } from "../service/webhook/webhookTestFixtures";

describe("WebhookEventSchema", () => {
  it("accepts an accepted event with no resolved_at, and a resolved event with one", () => {
    expect(WebhookEventSchema.safeParse(webhookEvent).success).toBe(true);
    const resolved = { ...webhookEvent, type: "ORDER_RESOLVED", data: { ...webhookEvent.data, resolved_at: "2026-10-11T09:27:40.000Z" } };
    expect(WebhookEventSchema.safeParse(resolved).success).toBe(true);
  });

  it("allows null address fields but not a missing order id", () => {
    const sparse = { ...webhookEvent, data: { ...webhookEvent.data, address: null, zip: null, borough: null } };
    expect(WebhookEventSchema.safeParse(sparse).success).toBe(true);
    expect(WebhookEventSchema.safeParse({ ...webhookEvent, data: { ...webhookEvent.data, order_id: "" } }).success).toBe(false);
  });

  it("rejects an event type outside the public catalogue", () => {
    expect(WebhookEventSchema.safeParse({ ...webhookEvent, type: "ORDER_SCHEDULED" }).success).toBe(false);
  });
});
