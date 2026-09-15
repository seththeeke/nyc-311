import type { Order } from "./order";

/**
 * Paginated Order-list result shape shared by `OrderDao`'s list methods
 * (e.g. `listOrdersWaitingForSchedule`) — `nextCursor` is an opaque,
 * DAO-encoded DynamoDB `LastEvaluatedKey`; a caller never inspects it,
 * just round-trips it into the next request.
 */
export interface OrderListResult {
  orders: Order[];
  nextCursor: string | null;
}
