import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { logInfo } from "../../logger";
import { OrderDao } from "../../dao/order/orderDao";
import { DEFAULT_ORDER_PAGE_SIZE, type OrderListQuery, type OrderListResult } from "../../models/orderListQuery";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/*
 * Constructed lazily inside listOrders, not at module scope — per
 * CLAUDE.md §5.2 (revised 2026-08-22). Controllers never construct or call
 * OrderDao directly (CLAUDE.md §5.2's "always go through a service to
 * reach a DAO" rule).
 */
function getDefaultOrderDao(): OrderDao {
  return new OrderDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), requireEnv("ORDERS_TABLE_NAME"));
}

/** Dependencies for {@link listOrders} — defaults to this module's own singleton; tests override it with a mock. */
export interface ListOrdersDeps {
  orderDao?: OrderDao;
}

/**
 * Backs the public `GET /orders` list view (3-order-ingestion.md) — a
 * paginated, optionally stage/status-filtered read of the Orders table.
 * Applies the default page size when the caller's query omits `limit`;
 * everything else passes straight through to `OrderDao.listOrders`.
 */
export async function listOrders(query: OrderListQuery, deps: ListOrdersDeps = {}): Promise<OrderListResult> {
  const orderDao = deps.orderDao ?? getDefaultOrderDao();
  logInfo("ListOrdersStarted", { query });

  const result = await orderDao.listOrders({
    limit: query.limit ?? DEFAULT_ORDER_PAGE_SIZE,
    cursor: query.cursor ?? null,
    stage: query.stage,
    status: query.status,
  });

  logInfo("ListOrdersCompleted", { count: result.orders.length, hasNextPage: result.nextCursor !== null });
  return result;
}
