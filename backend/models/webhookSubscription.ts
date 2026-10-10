import { z } from "zod";

/*
 * `WebhookSubscription` (13-customer-simulation.md §2/§5) — one row per
 * subscriber endpoint. The signing secret is never on the row, only the
 * SSM parameter name that holds it. Enum values ALL_CAPS per CLAUDE.md §6,
 * public event names included.
 */

/* The public event catalogue — its own list, deliberately not derived from the internal ORDER_EVENT_TYPES. */
export const WEBHOOK_EVENT_TYPES = ["ORDER_ACCEPTED", "ORDER_RESOLVED"] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export const WEBHOOK_SUBSCRIPTION_STATUSES = ["ACTIVE", "PAUSED"] as const;
export type WebhookSubscriptionStatus = (typeof WEBHOOK_SUBSCRIPTION_STATUSES)[number];

/* Hard cap enforced at create, which is what keeps the dispatcher's Scan bounded. */
export const MAX_WEBHOOK_SUBSCRIPTIONS = 25;

const MAX_NAME_LENGTH = 64;
const MAX_CALLBACK_URL_LENGTH = 2048;
const MAX_EVENT_TYPES = 10;
const MIN_SECRET_LENGTH = 32;
const MAX_SECRET_LENGTH = 128;
/* Standard Webhooks secret: the `whsec_` prefix plus a base64 key. */
const SECRET_PATTERN = /^whsec_[A-Za-z0-9+/]+={0,2}$/;

const EventTypesSchema = z
  .array(z.enum(WEBHOOK_EVENT_TYPES))
  .min(1)
  .max(MAX_EVENT_TYPES)
  .refine((types) => new Set(types).size === types.length, "Event types must be unique");

export const WebhookSubscriptionSchema = z.object({
  subscription_id: z.string().min(1),
  name: z.string().min(1).max(MAX_NAME_LENGTH),
  callback_url: z.string().min(1).max(MAX_CALLBACK_URL_LENGTH),
  event_types: EventTypesSchema,
  status: z.enum(WEBHOOK_SUBSCRIPTION_STATUSES),
  secret_parameter_name: z.string().min(1),
  version: z.number().int().positive(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
});
export type WebhookSubscription = z.infer<typeof WebhookSubscriptionSchema>;

/* What a subscriber sees — never the secret, never where it is stored. */
export const WebhookSubscriptionResponseSchema = WebhookSubscriptionSchema.omit({ secret_parameter_name: true });
export type WebhookSubscriptionResponse = z.infer<typeof WebhookSubscriptionResponseSchema>;

/* `POST /webhook-subscriptions` body. The subscriber supplies its own secret, so re-registering is idempotent. */
export const RegisterWebhookSubscriptionRequestSchema = z.object({
  name: z.string().min(1).max(MAX_NAME_LENGTH),
  callback_url: z.string().min(1).max(MAX_CALLBACK_URL_LENGTH),
  event_types: EventTypesSchema,
  secret: z.string().min(MIN_SECRET_LENGTH).max(MAX_SECRET_LENGTH).regex(SECRET_PATTERN, "Must be whsec_ followed by a base64 key"),
});
export type RegisterWebhookSubscriptionRequest = z.infer<typeof RegisterWebhookSubscriptionRequestSchema>;
