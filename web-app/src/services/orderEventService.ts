import { config } from "../config";
import {
  OrderEventListResponseSchema,
  type OrderEventListResponse,
  type OrderEventType,
} from "../models/order";
import { MOCK_ORDER_EVENTS } from "../test-data/orderEvents";

export interface ListOrderEventsParams {
  limit?: number;
  cursor?: string;
  order_id?: string;
  event_type?: OrderEventType;
}

/*
 * One interface, two implementations, selected by config.dataMode
 * (CLAUDE.md §5.1) — same shape as orderService.ts.
 */
export interface OrderEventService {
  listOrderEvents(params: ListOrderEventsParams): Promise<OrderEventListResponse>;
}

function buildQueryString(params: ListOrderEventsParams): string {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.order_id) query.set("order_id", params.order_id);
  if (params.event_type) query.set("event_type", params.event_type);
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

class LiveOrderEventService implements OrderEventService {
  async listOrderEvents(params: ListOrderEventsParams): Promise<OrderEventListResponse> {
    /* Reads config.apiBaseUrl at call time, not import time — see orderService.ts's identical note. */
    const response = await fetch(`${config.apiBaseUrl}/order-events${buildQueryString(params)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch order events: HTTP ${response.status}`);
    }
    const body: unknown = await response.json();
    return OrderEventListResponseSchema.parse(body);
  }
}

const DEFAULT_MOCK_PAGE_SIZE = 20;

/*
 * Paginates/filters the baked MOCK_ORDER_EVENTS fixture in memory, same
 * "opaque next-array-offset cursor" shape as MockOrderService.
 */
class MockOrderEventService implements OrderEventService {
  async listOrderEvents(params: ListOrderEventsParams): Promise<OrderEventListResponse> {
    const filtered = MOCK_ORDER_EVENTS.filter(
      (event) =>
        (!params.order_id || event.order_id === params.order_id) &&
        (!params.event_type || event.event_type === params.event_type)
    );
    const limit = params.limit ?? DEFAULT_MOCK_PAGE_SIZE;
    const offset = params.cursor ? Number.parseInt(params.cursor, 10) || 0 : 0;
    const page = filtered.slice(offset, offset + limit);
    const nextOffset = offset + page.length;
    const nextCursor = nextOffset < filtered.length ? String(nextOffset) : null;
    return { events: page, nextCursor };
  }
}

export const orderEventService: OrderEventService =
  config.dataMode === "live" ? new LiveOrderEventService() : new MockOrderEventService();
