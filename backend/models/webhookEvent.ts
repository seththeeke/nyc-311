import { z } from "zod";
import { WEBHOOK_EVENT_TYPES } from "./webhookSubscription";

/*
 * The public webhook payload (13-customer-simulation.md §5) — a fat event,
 * so a subscriber never calls the bureau back. One order shape for every
 * event type; `resolved_at` is set only on ORDER_RESOLVED. Additive-only:
 * new fields may appear, a breaking change gets a new event name.
 * Deliberately absent: SLA, priority, operator, stage, costs, location_id.
 */

export const WebhookOrderDataSchema = z.object({
  order_id: z.string().min(1),
  request_id: z.string().min(1),
  external_unique_key: z.string().min(1),
  complaint_type: z.string().min(1).nullable(),
  descriptor: z.string().min(1).nullable(),
  borough: z.string().min(1).nullable(),
  address: z.string().min(1).nullable(),
  zip: z.string().min(1).nullable(),
  /* The 311 record's own created_date, as NYC Open Data publishes it (New York local time, no offset). */
  reported_at: z.string().min(1),
  accepted_at: z.string().min(1),
  resolved_at: z.string().min(1).optional(),
});
export type WebhookOrderData = z.infer<typeof WebhookOrderDataSchema>;

export const WebhookEventSchema = z.object({
  type: z.enum(WEBHOOK_EVENT_TYPES),
  /* When the event happened, not when this attempt was sent — that is the `webhook-timestamp` header. */
  timestamp: z.string().min(1),
  data: WebhookOrderDataSchema,
});
export type WebhookEvent = z.infer<typeof WebhookEventSchema>;
