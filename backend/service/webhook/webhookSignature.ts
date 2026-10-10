import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Standard Webhooks signing, HMAC variant (13-customer-simulation.md §5),
 * hand-written on node:crypto. The reference `standardwebhooks` package is
 * a test-only dependency that cross-checks every function here.
 */

export const WEBHOOK_ID_HEADER = "webhook-id";
export const WEBHOOK_TIMESTAMP_HEADER = "webhook-timestamp";
export const WEBHOOK_SIGNATURE_HEADER = "webhook-signature";

const SECRET_PREFIX = "whsec_";
const SIGNATURE_VERSION = "v1";
/* A delivery whose timestamp is further than this from now, either way, is rejected as a possible replay. */
export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

export interface WebhookSignatureInput {
  /** The `whsec_`-prefixed base64 secret. */
  secret: string;
  webhookId: string;
  /** Unix seconds this attempt is sent at. */
  timestampSeconds: number;
  /** The exact request body, byte for byte. */
  body: string;
}

function hmacBase64(input: WebhookSignatureInput): string {
  const key = Buffer.from(input.secret.startsWith(SECRET_PREFIX) ? input.secret.slice(SECRET_PREFIX.length) : input.secret, "base64");
  return createHmac("sha256", key).update(`${input.webhookId}.${input.timestampSeconds}.${input.body}`).digest("base64");
}

/** @returns The `webhook-signature` header value, `v1,<base64 HMAC-SHA256>`. */
export function signWebhook(input: WebhookSignatureInput): string {
  return `${SIGNATURE_VERSION},${hmacBase64(input)}`;
}

/** The three Standard Webhooks headers for one delivery attempt. */
export function buildWebhookHeaders(input: WebhookSignatureInput): Record<string, string> {
  return {
    [WEBHOOK_ID_HEADER]: input.webhookId,
    [WEBHOOK_TIMESTAMP_HEADER]: String(input.timestampSeconds),
    [WEBHOOK_SIGNATURE_HEADER]: signWebhook(input),
  };
}

export interface WebhookVerificationInput {
  secret: string;
  /** Request headers with lowercase names, as API Gateway's HTTP API delivers them. */
  headers: Record<string, string | undefined>;
  body: string;
  now: Date;
}

/**
 * Verifies a received delivery: all three headers present, the timestamp
 * within tolerance, and at least one `v1` signature in the (space
 * separated) header matching, compared in constant time.
 */
export function verifyWebhook(input: WebhookVerificationInput): boolean {
  const webhookId = input.headers[WEBHOOK_ID_HEADER];
  const rawTimestamp = input.headers[WEBHOOK_TIMESTAMP_HEADER];
  const signatureHeader = input.headers[WEBHOOK_SIGNATURE_HEADER];
  if (!webhookId || !rawTimestamp || !signatureHeader) return false;

  const timestampSeconds = Number(rawTimestamp);
  if (!Number.isInteger(timestampSeconds)) return false;
  const nowSeconds = Math.floor(input.now.getTime() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > WEBHOOK_TOLERANCE_SECONDS) return false;

  const expected = Buffer.from(hmacBase64({ secret: input.secret, webhookId, timestampSeconds, body: input.body }));
  return signatureHeader.split(" ").some((candidate) => {
    const [version, signature] = candidate.split(",");
    if (version !== SIGNATURE_VERSION || signature === undefined) return false;
    const actual = Buffer.from(signature);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}
