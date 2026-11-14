import { createDocumentClient } from "../../dynamoClient";
import { requireEnv } from "../../env";
import { WebhookSubscriptionDao } from "./webhookSubscriptionDao";

/**
 * Builds a fresh `WebhookSubscriptionDao` on every call, reading
 * `WEBHOOK_SUBSCRIPTIONS_TABLE_NAME` only then: the one place that names
 * this table's env var (§5.2: lazy, never module scope).
 */
export function getWebhookSubscriptionDao(): WebhookSubscriptionDao {
  return new WebhookSubscriptionDao(createDocumentClient(), requireEnv("WEBHOOK_SUBSCRIPTIONS_TABLE_NAME"));
}
