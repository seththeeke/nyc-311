import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { requireEnv } from "../../env";
import { logError, logInfo, logWarn } from "../../logger";
import { WebhookSubscriptionDao } from "../../dao/webhookSubscription/webhookSubscriptionDao";
import type { WebhookDeliveryTask } from "../../models/webhookDeliveryTask";
import { WebhookSecretStore } from "./webhookSecretStore";
import { buildWebhookHeaders } from "./webhookSignature";

/* A subscriber that hasn't answered in this long counts as a failed attempt. */
export const WEBHOOK_DELIVERY_TIMEOUT_MS = 10_000;

/* Constructed lazily (CLAUDE.md §5.2) — never a module-scope singleton. */
function getWebhookSubscriptionDao(): WebhookSubscriptionDao {
  return new WebhookSubscriptionDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), requireEnv("WEBHOOK_SUBSCRIPTIONS_TABLE_NAME"));
}

export interface WebhookDeliveryDeps {
  webhookSubscriptionDao?: WebhookSubscriptionDao;
  secretStore?: WebhookSecretStore;
  fetchFn?: typeof fetch;
  now?: () => Date;
}

export type WebhookDeliveryOutcome = "DELIVERED" | "DROPPED";

/**
 * Signs and POSTs one delivery. The subscription is re-read on every
 * attempt, so a pause or delete drops messages already in flight. Any
 * non-2xx response, timeout or network error throws — the queue's
 * redrive policy is the retry schedule, there is no retry logic here.
 *
 * @param attempt - SQS's `ApproximateReceiveCount` for this message, for the log line only.
 * @throws Error when the attempt failed and should be retried.
 */
export async function deliverWebhook(task: WebhookDeliveryTask, attempt: number, deps: WebhookDeliveryDeps = {}): Promise<WebhookDeliveryOutcome> {
  const dao = deps.webhookSubscriptionDao ?? getWebhookSubscriptionDao();
  const context = { webhookId: task.webhook_id, subscriptionId: task.subscription_id, eventType: task.event.type, attempt };

  const subscription = await dao.getSubscription(task.subscription_id);
  if (!subscription || subscription.status !== "ACTIVE") {
    logWarn("WebhookDeliveryDropped", { ...context, reason: subscription ? "SUBSCRIPTION_PAUSED" : "SUBSCRIPTION_NOT_FOUND" });
    return "DROPPED";
  }

  const secret = await (deps.secretStore ?? new WebhookSecretStore()).getSecret(subscription.secret_parameter_name);
  const now = (deps.now ?? (() => new Date()))();
  const body = JSON.stringify(task.event);
  const headers = buildWebhookHeaders({
    secret,
    webhookId: task.webhook_id,
    timestampSeconds: Math.floor(now.getTime() / 1000),
    body,
  });

  const startedAt = Date.now();
  let status: number;
  try {
    const response = await (deps.fetchFn ?? fetch)(subscription.callback_url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body,
      /* A registered URL must answer itself — a signed request is never bounced to another host. */
      redirect: "manual",
      signal: AbortSignal.timeout(WEBHOOK_DELIVERY_TIMEOUT_MS),
    });
    status = response.status;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logError("WebhookDeliveryAttempt", { ...context, outcome: "FAILED", status: null, latencyMs: Date.now() - startedAt, error });
    throw new Error(`Webhook ${task.webhook_id} delivery to subscription ${task.subscription_id} failed: ${error}`);
  }

  const latencyMs = Date.now() - startedAt;
  if (status < 200 || status >= 300) {
    logError("WebhookDeliveryAttempt", { ...context, outcome: "FAILED", status, latencyMs });
    throw new Error(`Webhook ${task.webhook_id} delivery to subscription ${task.subscription_id} returned ${status}`);
  }
  logInfo("WebhookDeliveryAttempt", { ...context, outcome: "DELIVERED", status, latencyMs });
  return "DELIVERED";
}
