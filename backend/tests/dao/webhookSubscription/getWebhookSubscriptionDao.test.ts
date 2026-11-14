import { afterEach, describe, expect, it, vi } from "vitest";
import { WebhookSubscriptionDao } from "../../../dao/webhookSubscription/webhookSubscriptionDao";
import { getWebhookSubscriptionDao } from "../../../dao/webhookSubscription/getWebhookSubscriptionDao";

describe("getWebhookSubscriptionDao", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds a new WebhookSubscriptionDao on every call", () => {
    vi.stubEnv("WEBHOOK_SUBSCRIPTIONS_TABLE_NAME", "WebhookSubscriptions-Test");
    const dao = getWebhookSubscriptionDao();
    expect(dao).toBeInstanceOf(WebhookSubscriptionDao);
    expect(getWebhookSubscriptionDao()).not.toBe(dao);
  });

  it("throws when WEBHOOK_SUBSCRIPTIONS_TABLE_NAME is missing", () => {
    vi.stubEnv("WEBHOOK_SUBSCRIPTIONS_TABLE_NAME", "");
    expect(() => getWebhookSubscriptionDao()).toThrow("WEBHOOK_SUBSCRIPTIONS_TABLE_NAME");
  });
});
