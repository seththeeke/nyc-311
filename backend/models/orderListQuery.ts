import { z } from "zod";
import { ORDER_STAGES, ORDER_STATUSES, type Order } from "./order";

/*
 * GET /orders query-string params (3-order-ingestion.md's Order list view)
 * and the paginated result both the DAO and service return. `limit` arrives
 * as a string off queryStringParameters, per ApiGatewayHttpEventSchema —
 * z.coerce turns it into a bounded integer. `cursor` is an opaque,
 * DAO-encoded DynamoDB LastEvaluatedKey; a caller never inspects it, just
 * round-trips it into the next request.
 */

export const DEFAULT_ORDER_PAGE_SIZE = 20;
export const MAX_ORDER_PAGE_SIZE = 100;

export const OrderListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_ORDER_PAGE_SIZE).optional(),
  cursor: z.string().min(1).optional(),
  stage: z.enum(ORDER_STAGES).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
});
export type OrderListQuery = z.infer<typeof OrderListQuerySchema>;

export interface OrderListResult {
  orders: Order[];
  nextCursor: string | null;
}
