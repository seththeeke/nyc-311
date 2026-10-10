import { createHash, timingSafeEqual } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ulid } from "ulid";
import { requireEnv } from "../../env";
import { logInfo, logWarn } from "../../logger";
import { WebhookSubscriptionDao } from "../../dao/webhookSubscription/webhookSubscriptionDao";
import { ConflictError, UnauthorizedError, ValidationError } from "../../models/errors";
import {
  MAX_WEBHOOK_SUBSCRIPTIONS,
  WebhookSubscriptionResponseSchema,
  type RegisterWebhookSubscriptionRequest,
  type WebhookSubscription,
  type WebhookSubscriptionResponse,
} from "../../models/webhookSubscription";
import { WebhookSecretStore } from "./webhookSecretStore";

/* Both constructed lazily, per function that needs one (CLAUDE.md §5.2) — never a module-scope singleton. */
function getWebhookSubscriptionDao(): WebhookSubscriptionDao {
  return new WebhookSubscriptionDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), requireEnv("WEBHOOK_SUBSCRIPTIONS_TABLE_NAME"));
}

function getSecretStore(): WebhookSecretStore {
  return new WebhookSecretStore();
}

export interface WebhookSubscriptionServiceDeps {
  webhookSubscriptionDao?: WebhookSubscriptionDao;
  secretStore?: WebhookSecretStore;
  now?: () => Date;
  newId?: () => string;
}

export interface RegisterWebhookSubscriptionResult {
  subscription: WebhookSubscriptionResponse;
  /** `false` when the callback URL was already registered and its row was updated in place. */
  created: boolean;
}

/* `<prefix>/registration-key` and `<prefix>/<subscription_id>/secret`, e.g. prefix `/nyc311/test/webhook`. */
function registrationKeyParameterName(): string {
  return `${requireEnv("WEBHOOK_SSM_PREFIX")}/registration-key`;
}

function secretParameterName(subscriptionId: string): string {
  return `${requireEnv("WEBHOOK_SSM_PREFIX")}/${subscriptionId}/secret`;
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/** Constant-time comparison; hashing first makes the two inputs the same length. */
function keysMatch(presented: string, expected: string): boolean {
  return timingSafeEqual(sha256(presented), sha256(expected));
}

/**
 * Shape checks plus the per-environment hostname allowlist — no address
 * range checks, since the bureau has no VPC to protect.
 *
 * @throws {@link ValidationError} for an unparseable, non-https or non-allowlisted URL.
 */
function assertCallbackUrlAllowed(callbackUrl: string): void {
  let url: URL;
  try {
    url = new URL(callbackUrl);
  } catch {
    throw new ValidationError("callback_url is not a valid URL");
  }
  if (url.protocol !== "https:") {
    throw new ValidationError("callback_url must use https");
  }
  const allowedHosts = requireEnv("WEBHOOK_ALLOWED_CALLBACK_HOSTS")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host.length > 0);
  if (!allowedHosts.includes(url.hostname.toLowerCase())) {
    logWarn("WebhookCallbackHostNotAllowed", { hostname: url.hostname, allowedHosts });
    throw new ValidationError(`callback_url host ${url.hostname} is not allowed`);
  }
}

function toResponse(subscription: WebhookSubscription): WebhookSubscriptionResponse {
  /* The response schema omits `secret_parameter_name`; parsing strips it. */
  return WebhookSubscriptionResponseSchema.parse(subscription);
}

/**
 * Registers a subscription, or updates the one already registered for
 * this `callback_url` (name, event types and secret; never `status`, so a
 * pause survives the subscriber's own re-registration).
 *
 * @param apiKey - The caller's `x-api-key` header value, if any.
 * @throws {@link UnauthorizedError} for a missing or wrong key.
 * @throws {@link ValidationError} for a disallowed callback URL.
 * @throws {@link ConflictError} when the subscription cap is reached.
 * @throws {@link TerminalError} if a concurrent write won the version check.
 */
export async function registerWebhookSubscription(
  request: RegisterWebhookSubscriptionRequest,
  apiKey: string | undefined,
  deps: WebhookSubscriptionServiceDeps = {}
): Promise<RegisterWebhookSubscriptionResult> {
  const secretStore = deps.secretStore ?? getSecretStore();
  if (!apiKey || !keysMatch(apiKey, await secretStore.getSecret(registrationKeyParameterName()))) {
    logWarn("WebhookRegistrationUnauthorized", { keyPresented: Boolean(apiKey) });
    throw new UnauthorizedError("Missing or invalid registration key");
  }
  assertCallbackUrlAllowed(request.callback_url);

  const dao = deps.webhookSubscriptionDao ?? getWebhookSubscriptionDao();
  const now = (deps.now ?? (() => new Date()))().toISOString();
  const subscriptions = await dao.listSubscriptions();
  const existing = subscriptions.find((subscription) => subscription.callback_url === request.callback_url);

  if (existing) {
    const updated: WebhookSubscription = {
      ...existing,
      name: request.name,
      event_types: request.event_types,
      version: existing.version + 1,
      updated_at: now,
    };
    logInfo("WebhookSubscriptionUpdating", { subscriptionId: existing.subscription_id, fromVersion: existing.version, status: existing.status });
    await dao.replaceSubscription(updated, existing.version);
    await secretStore.putSecret(existing.secret_parameter_name, request.secret);
    logInfo("WebhookSubscriptionUpdated", { subscriptionId: existing.subscription_id, version: updated.version });
    return { subscription: toResponse(updated), created: false };
  }

  if (subscriptions.length >= MAX_WEBHOOK_SUBSCRIPTIONS) {
    logWarn("WebhookSubscriptionCapReached", { count: subscriptions.length, cap: MAX_WEBHOOK_SUBSCRIPTIONS });
    throw new ConflictError(`Subscription cap of ${MAX_WEBHOOK_SUBSCRIPTIONS} reached`);
  }

  const subscriptionId = (deps.newId ?? ulid)();
  const created: WebhookSubscription = {
    subscription_id: subscriptionId,
    name: request.name,
    callback_url: request.callback_url,
    event_types: request.event_types,
    status: "ACTIVE",
    secret_parameter_name: secretParameterName(subscriptionId),
    version: 1,
    created_at: now,
    updated_at: now,
  };
  logInfo("WebhookSubscriptionCreating", { subscriptionId, callbackUrl: created.callback_url, eventTypes: created.event_types });
  /* Row first: if the secret write then fails, the same registration retried finds the row and writes the secret. */
  await dao.createSubscription(created);
  await secretStore.putSecret(created.secret_parameter_name, request.secret);
  logInfo("WebhookSubscriptionCreated", { subscriptionId });
  return { subscription: toResponse(created), created: true };
}
