import { describe, expect, it } from "vitest";
import { WebhookCustomerFacingOrderSchema } from "../../models/webhookCustomerFacingOrder";
import { openOrder } from "../fixtures";

describe("WebhookCustomerFacingOrderSchema", () => {
  it("accepts an open row and a closed one", () => {
    expect(WebhookCustomerFacingOrderSchema.parse(openOrder)).toEqual(openOrder);
    const closed = { ...openOrder, status: "CLOSED", resolved_at: "2026-10-11T09:27:40.000Z" };
    expect(WebhookCustomerFacingOrderSchema.safeParse(closed).success).toBe(true);
  });

  it("rejects an unknown status", () => {
    expect(WebhookCustomerFacingOrderSchema.safeParse({ ...openOrder, status: "PENDING" }).success).toBe(false);
  });

  it("drops an expires_at left on a row written before rows stopped expiring", () => {
    expect(WebhookCustomerFacingOrderSchema.parse({ ...openOrder, expires_at: 1796479391 })).toEqual(openOrder);
  });
});
