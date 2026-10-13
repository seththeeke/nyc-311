import { z } from "zod";

/*
 * The customer's own reading of the bureau's public webhook payload
 * (docs/13-customer-simulation.md §5) — written from the published
 * contract, not shared with the sender. Unknown fields are ignored, per
 * the contract's additive-only versioning. `type` stays a plain string so
 * an event type added later is acknowledged and ignored, not rejected.
 */

export const BUREAU_ORDER_ACCEPTED = "ORDER_ACCEPTED";
export const BUREAU_ORDER_RESOLVED = "ORDER_RESOLVED";

export const BureauOrderDataSchema = z.object({
  order_id: z.string().min(1),
  request_id: z.string().min(1),
  external_unique_key: z.string().min(1),
  complaint_type: z.string().min(1).nullable(),
  descriptor: z.string().min(1).nullable(),
  borough: z.string().min(1).nullable(),
  address: z.string().min(1).nullable(),
  zip: z.string().min(1).nullable(),
  reported_at: z.string().min(1),
  accepted_at: z.string().min(1),
  resolved_at: z.string().min(1).optional(),
});
export type BureauOrderData = z.infer<typeof BureauOrderDataSchema>;

export const BureauWebhookEventSchema = z.object({
  type: z.string().min(1),
  timestamp: z.string().min(1),
  data: BureauOrderDataSchema,
});
export type BureauWebhookEvent = z.infer<typeof BureauWebhookEventSchema>;
