import { describe, expect, it } from "vitest";
import { BureauWebhookEventSchema } from "../../models/bureauWebhookEvent";
import { acceptedEvent, resolvedEvent } from "../fixtures";

describe("BureauWebhookEventSchema", () => {
  it("reads an accepted and a resolved event", () => {
    expect(BureauWebhookEventSchema.parse(acceptedEvent)).toEqual(acceptedEvent);
    expect(BureauWebhookEventSchema.parse(resolvedEvent)).toEqual(resolvedEvent);
  });

  it("ignores fields added later, per the contract's additive-only versioning", () => {
    const withExtras = { ...acceptedEvent, extra: 1, data: { ...acceptedEvent.data, priority_tier: "P1" } };
    expect(BureauWebhookEventSchema.parse(withExtras)).toEqual(acceptedEvent);
  });

  it("accepts an event type it does not know, and null address fields", () => {
    expect(BureauWebhookEventSchema.safeParse({ ...acceptedEvent, type: "ORDER_SCHEDULED" }).success).toBe(true);
    const sparse = { ...acceptedEvent, data: { ...acceptedEvent.data, borough: null, address: null, zip: null } };
    expect(BureauWebhookEventSchema.safeParse(sparse).success).toBe(true);
  });

  it("rejects an event with no order id or no data", () => {
    expect(BureauWebhookEventSchema.safeParse({ ...acceptedEvent, data: { ...acceptedEvent.data, order_id: "" } }).success).toBe(false);
    expect(BureauWebhookEventSchema.safeParse({ type: "ORDER_ACCEPTED", timestamp: "x" }).success).toBe(false);
  });
});
