import { describe, expect, it } from "vitest";
import {
  RegisterWebhookSubscriptionRequestSchema,
  WebhookSubscriptionResponseSchema,
  WebhookSubscriptionSchema,
} from "../../models/webhookSubscription";
import { SECRET, subscription } from "../service/webhook/webhookTestFixtures";

const request = {
  name: "the-customer",
  callback_url: "https://customer-api.boroughsim.com/webhooks/bureau",
  event_types: ["ORDER_ACCEPTED"],
  secret: SECRET,
};

describe("WebhookSubscriptionSchema", () => {
  it("accepts a well-formed row", () => {
    expect(WebhookSubscriptionSchema.parse(subscription)).toEqual(subscription);
  });

  it("rejects an unknown status, an unknown event type, and an empty event list", () => {
    expect(WebhookSubscriptionSchema.safeParse({ ...subscription, status: "DISABLED" }).success).toBe(false);
    expect(WebhookSubscriptionSchema.safeParse({ ...subscription, event_types: ["ORDER_CREATED"] }).success).toBe(false);
    expect(WebhookSubscriptionSchema.safeParse({ ...subscription, event_types: [] }).success).toBe(false);
  });

  it("rejects duplicate event types and a wildcard", () => {
    expect(WebhookSubscriptionSchema.safeParse({ ...subscription, event_types: ["ORDER_ACCEPTED", "ORDER_ACCEPTED"] }).success).toBe(false);
    expect(WebhookSubscriptionSchema.safeParse({ ...subscription, event_types: ["*"] }).success).toBe(false);
  });
});

describe("WebhookSubscriptionResponseSchema", () => {
  it("strips the secret parameter name", () => {
    expect(WebhookSubscriptionResponseSchema.parse(subscription)).not.toHaveProperty("secret_parameter_name");
  });
});

describe("RegisterWebhookSubscriptionRequestSchema", () => {
  it("accepts a well-formed request", () => {
    expect(RegisterWebhookSubscriptionRequestSchema.safeParse(request).success).toBe(true);
  });

  it("rejects a secret that is too short, too long, or not whsec_ base64", () => {
    expect(RegisterWebhookSubscriptionRequestSchema.safeParse({ ...request, secret: "whsec_abc" }).success).toBe(false);
    expect(RegisterWebhookSubscriptionRequestSchema.safeParse({ ...request, secret: `whsec_${"a".repeat(130)}` }).success).toBe(false);
    expect(RegisterWebhookSubscriptionRequestSchema.safeParse({ ...request, secret: "a".repeat(40) }).success).toBe(false);
  });

  it("rejects an over-long name or callback URL", () => {
    expect(RegisterWebhookSubscriptionRequestSchema.safeParse({ ...request, name: "n".repeat(65) }).success).toBe(false);
    expect(RegisterWebhookSubscriptionRequestSchema.safeParse({ ...request, callback_url: `https://x.test/${"a".repeat(2048)}` }).success).toBe(false);
  });
});
