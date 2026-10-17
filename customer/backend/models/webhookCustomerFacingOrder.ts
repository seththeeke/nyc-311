import { z } from "zod";

/*
 * The customer's own row per order in play
 * (docs/13-customer-simulation.md, decision 2026-10-13). `OPEN` from the
 * bureau's ORDER_ACCEPTED until its ORDER_RESOLVED makes it `CLOSED`; a
 * closed row stays as a marker so a late accept can never reopen it. Rows
 * never expire (decision 6, 2026-10-17): ideas reference orders by id.
 * Enum values ALL_CAPS per CLAUDE.md §6.
 */

export const CUSTOMER_FACING_ORDER_STATUSES = ["OPEN", "CLOSED"] as const;
export type CustomerFacingOrderStatus = (typeof CUSTOMER_FACING_ORDER_STATUSES)[number];

export const WebhookCustomerFacingOrderSchema = z.object({
  order_id: z.string().min(1),
  status: z.enum(CUSTOMER_FACING_ORDER_STATUSES),
  request_id: z.string().min(1),
  external_unique_key: z.string().min(1),
  complaint_type: z.string().min(1).nullable(),
  descriptor: z.string().min(1).nullable(),
  borough: z.string().min(1).nullable(),
  address: z.string().min(1).nullable(),
  zip: z.string().min(1).nullable(),
  reported_at: z.string().min(1),
  accepted_at: z.string().min(1),
  resolved_at: z.string().min(1).nullable(),
  /* The `webhook-id` of the delivery that last wrote this row. */
  last_webhook_id: z.string().min(1),
  updated_at: z.string().min(1),
});
export type WebhookCustomerFacingOrder = z.infer<typeof WebhookCustomerFacingOrderSchema>;
