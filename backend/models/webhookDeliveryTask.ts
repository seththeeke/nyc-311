import { z } from "zod";
import { WebhookEventSchema } from "./webhookEvent";

/*
 * One message on the webhook delivery queue (13-customer-simulation.md §3
 * Flow A): one public event for one subscription, built once by the
 * dispatcher. `webhook_id` is `evt_<order_id>_<sequence_number>` — the
 * same on every retry and for every subscriber, so receivers dedupe on it.
 */

export const WebhookDeliveryTaskSchema = z.object({
  webhook_id: z.string().min(1),
  subscription_id: z.string().min(1),
  event: WebhookEventSchema,
});
export type WebhookDeliveryTask = z.infer<typeof WebhookDeliveryTaskSchema>;
