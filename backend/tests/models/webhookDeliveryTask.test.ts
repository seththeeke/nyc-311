import { describe, expect, it } from "vitest";
import { WebhookDeliveryTaskSchema } from "../../models/webhookDeliveryTask";
import { webhookEvent } from "../service/webhook/webhookTestFixtures";

describe("WebhookDeliveryTaskSchema", () => {
  it("accepts a well-formed task and rejects one with no subscription", () => {
    const task = { webhook_id: "evt_01ORDER_1", subscription_id: "01SUB", event: webhookEvent };
    expect(WebhookDeliveryTaskSchema.safeParse(task).success).toBe(true);
    expect(WebhookDeliveryTaskSchema.safeParse({ ...task, subscription_id: "" }).success).toBe(false);
  });
});
