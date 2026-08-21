import { z } from "zod";

/*
 * Mirrors backend/models/order.ts's Order projection (the OrderSchema half
 * only — OrderEvent never crosses the network boundary today) plus the
 * paginated envelope GET /orders returns (backend/models/orderListQuery.ts's
 * OrderListResult). Every service response is parsed through this schema
 * before it reaches a component (CLAUDE.md §5.1's "runtime validation at
 * the network boundary" rule).
 */

export const ORDER_STAGES = ["INGEST", "SCHEDULE", "EXECUTE", "RESOLVE"] as const;
export type OrderStage = (typeof ORDER_STAGES)[number];

export const ORDER_STATUSES = ["CREATED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

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
