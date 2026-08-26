import { z } from "zod";
import { ORDER_EVENT_TYPES, type OrderEvent } from "./order";

/*
 * GET /order-events query-string params (5-order-evaluation.md's Order
 * Events list view, same shape as orderListQuery.ts's GET /orders) and the
 * paginated result both the DAO and service return. `order_id`, when
 * given, switches the DAO to a Query on that partition instead of a
 * table-wide Scan — see OrderDao.listOrderEvents.
 */

export const DEFAULT_ORDER_EVENT_PAGE_SIZE = 20;
export const MAX_ORDER_EVENT_PAGE_SIZE = 100;

export const OrderEventListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_ORDER_EVENT_PAGE_SIZE).optional(),
  cursor: z.string().min(1).optional(),
  order_id: z.string().min(1).optional(),
  event_type: z.enum(ORDER_EVENT_TYPES).optional(),
});
export type OrderEventListQuery = z.infer<typeof OrderEventListQuerySchema>;

export interface OrderEventListResult {
  events: OrderEvent[];
  nextCursor: string | null;
}
