import { afterEach, describe, expect, it, vi } from "vitest";
import { getWebhookCustomerFacingOrderDao } from "../../../dao/webhookCustomerFacingOrder/getWebhookCustomerFacingOrderDao";
import { WebhookCustomerFacingOrderDao } from "../../../dao/webhookCustomerFacingOrder/webhookCustomerFacingOrderDao";

describe("getWebhookCustomerFacingOrderDao", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds a new WebhookCustomerFacingOrderDao on every call", () => {
    vi.stubEnv("CUSTOMER_ORDERS_TABLE_NAME", "CustomerOrders-Prod");
    const dao = getWebhookCustomerFacingOrderDao();
    expect(dao).toBeInstanceOf(WebhookCustomerFacingOrderDao);
    expect(getWebhookCustomerFacingOrderDao()).not.toBe(dao);
  });

  it("throws when CUSTOMER_ORDERS_TABLE_NAME is missing", () => {
    vi.stubEnv("CUSTOMER_ORDERS_TABLE_NAME", "");
    expect(() => getWebhookCustomerFacingOrderDao()).toThrow("CUSTOMER_ORDERS_TABLE_NAME");
  });
});
