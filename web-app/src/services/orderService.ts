import { config } from "../config";
import { OrderListResponseSchema, type OrderListResponse, type OrderStage, type OrderStatus } from "../models/order";
import { MOCK_ORDERS } from "../test-data/orders";

export interface ListOrdersParams {
  limit?: number;
  cursor?: string;
  stage?: OrderStage;
  status?: OrderStatus;
}

/*
 * One interface, two implementations, selected by config.dataMode
 * (CLAUDE.md §5.1) — the same shape is directly importable in tests, no
 * separate test-only mocking story needed.
 */
export interface OrderService {
  listOrders(params: ListOrdersParams): Promise<OrderListResponse>;
}

function buildQueryString(params: ListOrdersParams): string {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.stage) query.set("stage", params.stage);
  if (params.status) query.set("status", params.status);
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

class LiveOrderService implements OrderService {
  async listOrders(params: ListOrdersParams): Promise<OrderListResponse> {
    /* Reads config.apiBaseUrl at call time, not import time — see pollerMetricsService.ts's identical note. */
    const response = await fetch(`${config.apiBaseUrl}/orders${buildQueryString(params)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch orders: HTTP ${response.status}`);
    }
    const body: unknown = await response.json();
    return OrderListResponseSchema.parse(body);
  }
}

const DEFAULT_MOCK_PAGE_SIZE = 20;

/*
 * Paginates/filters the baked MOCK_ORDERS fixture in memory so the "mock"
 * data mode demonstrates the same stage/status filtering and cursor-based
 * pagination the live API supports — the cursor here is just the next
 * array offset as a string, opaque to every caller exactly like the live
 * API's DynamoDB-derived one.
 */
class MockOrderService implements OrderService {
  async listOrders(params: ListOrdersParams): Promise<OrderListResponse> {
    const filtered = MOCK_ORDERS.filter(
      (order) =>
        (!params.stage || order.current_stage === params.stage) &&
        (!params.status || order.status === params.status)
    );
    const limit = params.limit ?? DEFAULT_MOCK_PAGE_SIZE;
    const offset = params.cursor ? Number.parseInt(params.cursor, 10) || 0 : 0;
    const page = filtered.slice(offset, offset + limit);
    const nextOffset = offset + page.length;
    const nextCursor = nextOffset < filtered.length ? String(nextOffset) : null;
    return { orders: page, nextCursor };
  }
}

export const orderService: OrderService =
  config.dataMode === "live" ? new LiveOrderService() : new MockOrderService();
