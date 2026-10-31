import { z } from "zod";
import { TimestampSchema, UlidSchema } from "./publicApiPrimitives";

/*
 * The public view of a 311 complaint as BoroughSim handles it
 * (16-resident-action-models.md §2.4.1), built from an Order and its
 * Location. Never carries SLA, priority, operator, stage, costs or
 * coordinates.
 */

export const SERVICE_REQUEST_STATUSES = ["RECEIVED", "ACCEPTED", "SCHEDULED", "IN_PROGRESS", "RESOLVED", "NOT_SERVICED"] as const;
export type ServiceRequestStatus = (typeof SERVICE_REQUEST_STATUSES)[number];

export const ScheduledWindowSchema = z.object({
  start: TimestampSchema,
  end: TimestampSchema,
});

export const ServiceRequestSchema = z.object({
  order_id: UlidSchema,
  request_id: z.string().min(1),
  complaint_type: z.string().min(1).nullable(),
  borough: z.string().min(1).nullable(),
  address: z.string().min(1).nullable(),
  zip: z.string().min(1).nullable(),
  status: z.enum(SERVICE_REQUEST_STATUSES),
  status_reason_description: z.string().min(1).nullable(),
  scheduled_window: ScheduledWindowSchema.nullable(),
  received_at: TimestampSchema,
  status_updated_at: TimestampSchema,
});
export type ServiceRequest = z.infer<typeof ServiceRequestSchema>;
