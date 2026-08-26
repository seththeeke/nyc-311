import { z } from "zod";

/*
 * Mirrors backend/models/order.ts's Order projection and OrderEvent shapes,
 * plus the paginated envelopes GET /orders and GET /order-events return
 * (backend/models/orderListQuery.ts's OrderListResult and
 * orderEventListQuery.ts's OrderEventListResult). Every service response is
 * parsed through the matching schema before it reaches a component
 * (CLAUDE.md §5.1's "runtime validation at the network boundary" rule).
 */

export const ORDER_STAGES = ["INGEST", "SCHEDULE", "EXECUTE", "RESOLVE"] as const;
export type OrderStage = (typeof ORDER_STAGES)[number];

export const ORDER_STATUSES = ["CREATED", "ACTIVE", "REJECTED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_EVENT_TYPES = [
  "ORDER_CREATED",
  "STAGE_STARTED",
  "STAGE_SUCCEEDED",
  "STAGE_FAILED",
  "STAGE_RETRIED",
  "FAILURE_INJECTED",
  "PRIORITY_ASSIGNED",
  "ORDER_SCHEDULED",
  "ORDER_ASSIGNED",
  "ORDER_ACCEPTED",
  "ORDER_REJECTED",
  "CASE_CREATED",
  "ORDER_RESOLVED",
  "ORDER_FAILED_TERMINAL",
] as const;
export type OrderEventType = (typeof ORDER_EVENT_TYPES)[number];

export const ACTORS = ["SYSTEM", "AGENT", "ADMIN"] as const;
export type Actor = (typeof ACTORS)[number];

export const OrderSchema = z.object({
  order_id: z.string().min(1),
  request_id: z.string().min(1),
  location_id: z.string().min(1),
  current_stage: z.enum(ORDER_STAGES),
  status: z.enum(ORDER_STATUSES),
  retry_counts: z.record(z.enum(ORDER_STAGES), z.number().int().nonnegative()),
  priority_tier: z.string().min(1).nullable(),
  sla_deadline: z.string().min(1).nullable(),
  scheduled_start: z.string().min(1).nullable(),
  scheduled_end: z.string().min(1).nullable(),
  assigned_operator_id: z.string().min(1).nullable(),
  reassignment_count: z.number().int().nonnegative(),
  case_id: z.string().min(1).nullable(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  last_event_sequence: z.number().int().nonnegative(),
});
export type Order = z.infer<typeof OrderSchema>;

export const OrderListResponseSchema = z.object({
  orders: z.array(OrderSchema),
  nextCursor: z.string().min(1).nullable(),
});
export type OrderListResponse = z.infer<typeof OrderListResponseSchema>;

export const OrderEventSchema = z.object({
  order_id: z.string().min(1),
  sequence_number: z.number().int().nonnegative(),
  event_type: z.enum(ORDER_EVENT_TYPES),
  stage: z.enum(ORDER_STAGES).nullable(),
  payload: z.record(z.string(), z.unknown()),
  occurred_at: z.string().min(1),
  actor: z.enum(ACTORS),
});
export type OrderEvent = z.infer<typeof OrderEventSchema>;

export const OrderEventListResponseSchema = z.object({
  events: z.array(OrderEventSchema),
  nextCursor: z.string().min(1).nullable(),
});
export type OrderEventListResponse = z.infer<typeof OrderEventListResponseSchema>;
