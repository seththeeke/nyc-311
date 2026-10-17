import { describe, expect, it } from "vitest";
import { BoroughSimWebhookEventSchema } from "../../models/boroughSimWebhookEvent";
import { acceptedEvent, resolvedEvent } from "../fixtures";

describe("BoroughSimWebhookEventSchema", () => {
  it("reads an accepted and a resolved event", () => {
    expect(BoroughSimWebhookEventSchema.parse(acceptedEvent)).toEqual(acceptedEvent);
    expect(BoroughSimWebhookEventSchema.parse(resolvedEvent)).toEqual(resolvedEvent);
  });

  it("ignores fields added later, per the contract's additive-only versioning", () => {
    const withExtras = { ...acceptedEvent, extra: 1, data: { ...acceptedEvent.data, priority_tier: "P1" } };
    expect(BoroughSimWebhookEventSchema.parse(withExtras)).toEqual(acceptedEvent);
  });

  it("accepts an event type it does not know, and null address fields", () => {
    expect(BoroughSimWebhookEventSchema.safeParse({ ...acceptedEvent, type: "ORDER_SCHEDULED" }).success).toBe(true);
    const sparse = { ...acceptedEvent, data: { ...acceptedEvent.data, borough: null, address: null, zip: null } };
    expect(BoroughSimWebhookEventSchema.safeParse(sparse).success).toBe(true);
  });

  it("rejects an event with no order id or no data", () => {
    expect(BoroughSimWebhookEventSchema.safeParse({ ...acceptedEvent, data: { ...acceptedEvent.data, order_id: "" } }).success).toBe(false);
    expect(BoroughSimWebhookEventSchema.safeParse({ type: "ORDER_ACCEPTED", timestamp: "x" }).success).toBe(false);
  });
});
