import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { requireEnv } from "../../env";
import { logInfo, logWarn } from "../../logger";
import { WebhookSinkDeliveryDao } from "../../dao/webhookSinkDelivery/webhookSinkDeliveryDao";
import { ValidationError } from "../../models/errors";
import type { WebhookSinkDelivery } from "../../models/webhookSinkDelivery";
import { WebhookSecretStore } from "./webhookSecretStore";
import { WEBHOOK_ID_HEADER, verifyWebhook } from "./webhookSignature";

/* How long a sink record lives — long enough for the integration check's 24-hour look-back, short enough to stay small. */
const SINK_RECORD_TTL_SECONDS = 7 * 24 * 60 * 60;
/* The most records `GET /webhook-sink/deliveries` returns. */
export const SINK_LIST_LIMIT = 50;

/* Constructed lazily (CLAUDE.md §5.2) — never a module-scope singleton. */
function getWebhookSinkDeliveryDao(): WebhookSinkDeliveryDao {
  return new WebhookSinkDeliveryDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), requireEnv("WEBHOOK_SINK_DELIVERIES_TABLE_NAME"));
}

export interface WebhookSinkDeps {
  webhookSinkDeliveryDao?: WebhookSinkDeliveryDao;
  secretStore?: WebhookSecretStore;
  now?: () => Date;
}

function eventTypeOf(body: string): string | null {
  try {
    const parsed: unknown = JSON.parse(body);
    const type = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>)["type"] : undefined;
    return typeof type === "string" && type.length > 0 ? type : null;
  } catch {
    return null;
  }
}

/**
 * The Test-only sink subscriber (`13-customer-simulation.md` §5): checks
 * the delivery's signature against the sink's own secret and records the
 * result either way, so a bad signature is visible, not just rejected.
 *
 * @returns Whether the signature was valid.
 * @throws {@link ValidationError} if the `webhook-id` header is missing.
 */
export async function receiveSinkDelivery(headers: Record<string, string | undefined>, body: string, deps: WebhookSinkDeps = {}): Promise<boolean> {
  const webhookId = headers[WEBHOOK_ID_HEADER];
  if (!webhookId) {
    logWarn("WebhookSinkMissingId", {});
    throw new ValidationError("Missing webhook-id header");
  }
  const now = (deps.now ?? (() => new Date()))();
  const secret = await (deps.secretStore ?? new WebhookSecretStore()).getSecret(requireEnv("WEBHOOK_SINK_SECRET_PARAMETER_NAME"));
  const signatureValid = verifyWebhook({ secret, headers, body, now });

  const delivery: WebhookSinkDelivery = {
    webhook_id: webhookId,
    event_type: eventTypeOf(body),
    received_at: now.toISOString(),
    signature_valid: signatureValid,
    expires_at: Math.floor(now.getTime() / 1000) + SINK_RECORD_TTL_SECONDS,
  };
  await (deps.webhookSinkDeliveryDao ?? getWebhookSinkDeliveryDao()).putDelivery(delivery);
  logInfo(signatureValid ? "WebhookSinkDeliveryAccepted" : "WebhookSinkDeliveryRejected", { webhookId, eventType: delivery.event_type });
  return signatureValid;
}

/** The most recent sink deliveries, newest first, capped at {@link SINK_LIST_LIMIT}. */
export async function listSinkDeliveries(deps: WebhookSinkDeps = {}): Promise<WebhookSinkDelivery[]> {
  const deliveries = await (deps.webhookSinkDeliveryDao ?? getWebhookSinkDeliveryDao()).listDeliveries();
  deliveries.sort((a, b) => b.received_at.localeCompare(a.received_at));
  logInfo("WebhookSinkDeliveriesListed", { total: deliveries.length, returned: Math.min(deliveries.length, SINK_LIST_LIMIT) });
  return deliveries.slice(0, SINK_LIST_LIMIT);
}
