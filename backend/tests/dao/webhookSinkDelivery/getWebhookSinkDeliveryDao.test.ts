import { afterEach, describe, expect, it, vi } from "vitest";
import { WebhookSinkDeliveryDao } from "../../../dao/webhookSinkDelivery/webhookSinkDeliveryDao";
import { getWebhookSinkDeliveryDao } from "../../../dao/webhookSinkDelivery/getWebhookSinkDeliveryDao";

describe("getWebhookSinkDeliveryDao", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds a new WebhookSinkDeliveryDao on every call", () => {
    vi.stubEnv("WEBHOOK_SINK_DELIVERIES_TABLE_NAME", "WebhookSinkDeliveries-Test");
    const dao = getWebhookSinkDeliveryDao();
    expect(dao).toBeInstanceOf(WebhookSinkDeliveryDao);
    expect(getWebhookSinkDeliveryDao()).not.toBe(dao);
  });

  it("throws when WEBHOOK_SINK_DELIVERIES_TABLE_NAME is missing", () => {
    vi.stubEnv("WEBHOOK_SINK_DELIVERIES_TABLE_NAME", "");
    expect(() => getWebhookSinkDeliveryDao()).toThrow("WEBHOOK_SINK_DELIVERIES_TABLE_NAME");
  });
});
