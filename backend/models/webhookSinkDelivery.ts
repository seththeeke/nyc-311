import { z } from "zod";

/*
 * One delivery the Test-only webhook sink received
 * (13-customer-simulation.md §5, testing decision) — keyed by
 * `webhook_id`, so a redelivery overwrites. `expires_at` is the table's
 * TTL attribute (epoch seconds).
 */

export const WebhookSinkDeliverySchema = z.object({
  webhook_id: z.string().min(1),
  /* The payload's `type` when the body parsed; null for a body the sink could not read. */
  event_type: z.string().min(1).nullable(),
  received_at: z.string().min(1),
  signature_valid: z.boolean(),
  expires_at: z.number().int().positive(),
});
export type WebhookSinkDelivery = z.infer<typeof WebhookSinkDeliverySchema>;
