import { describe, expect, it } from "vitest";
import { WebhookCustomerFacingOrderSchema } from "../../models/webhookCustomerFacingOrder";
import { openOrder } from "../fixtures";

describe("WebhookCustomerFacingOrderSchema", () => {
  it("accepts an open row and a closed one", () => {
    expect(WebhookCustomerFacingOrderSchema.parse(openOrder)).toEqual(openOrder);
    const closed = { ...openOrder, status: "CLOSED", resolved_at: "2026-10-11T09:27:40.000Z" };
    expect(WebhookCustomerFacingOrderSchema.safeParse(closed).success).toBe(true);
  });

  it("rejects an unknown status and a non-positive TTL", () => {
    expect(WebhookCustomerFacingOrderSchema.safeParse({ ...openOrder, status: "PENDING" }).success).toBe(false);
    expect(WebhookCustomerFacingOrderSchema.safeParse({ ...openOrder, expires_at: 0 }).success).toBe(false);
  });
});
