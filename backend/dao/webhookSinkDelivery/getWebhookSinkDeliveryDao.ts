import { createDocumentClient } from "../../dynamoClient";
import { requireEnv } from "../../env";
import { WebhookSinkDeliveryDao } from "./webhookSinkDeliveryDao";

/**
 * Builds a fresh `WebhookSinkDeliveryDao` on every call, reading
 * `WEBHOOK_SINK_DELIVERIES_TABLE_NAME` only then: the one place that names
 * this table's env var (§5.2: lazy, never module scope).
 */
export function getWebhookSinkDeliveryDao(): WebhookSinkDeliveryDao {
  return new WebhookSinkDeliveryDao(createDocumentClient(), requireEnv("WEBHOOK_SINK_DELIVERIES_TABLE_NAME"));
}
