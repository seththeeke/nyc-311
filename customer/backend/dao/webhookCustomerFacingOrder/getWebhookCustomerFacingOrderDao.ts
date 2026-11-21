import { createDocumentClient } from "../../dynamoClient";
import { requireEnv } from "../../env";
import { WebhookCustomerFacingOrderDao } from "./webhookCustomerFacingOrderDao";

/**
 * Builds a fresh `WebhookCustomerFacingOrderDao` on every call, reading
 * `CUSTOMER_ORDERS_TABLE_NAME` only then: the one place that names this
 * table's env var (CLAUDE.md §5.2: lazy, never module scope).
 */
export function getWebhookCustomerFacingOrderDao(): WebhookCustomerFacingOrderDao {
  return new WebhookCustomerFacingOrderDao(createDocumentClient(), requireEnv("CUSTOMER_ORDERS_TABLE_NAME"));
}
