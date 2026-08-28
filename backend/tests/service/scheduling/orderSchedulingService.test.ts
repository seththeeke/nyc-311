import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scheduleOrders } from "../../../service/scheduling/orderSchedulingService";
import type { OrderSchedulingDeps } from "../../../service/scheduling/orderSchedulingService";
import type { OrderDao } from "../../../dao/order/orderDao";
import type { RequestDao } from "../../../dao/request/requestDao";
import type { LocationDao } from "../../../dao/location/locationDao";
import type { OperatorDao } from "../../../dao/operator/operatorDao";
import type { Order } from "../../../models/order";
import type { Request } from "../../../models/request";
import type { Location } from "../../../models/location";

const ddbMock = mockClient(DynamoDBDocumentClient);
const NOW = new Date("2026-08-28T12:00:00.000Z");

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    order_id: "01ORDER",
    request_id: "01REQUEST",
    location_id: "1234567890",
    current_stage: "SCHEDULE",
    status: "ACTIVE",
    retry_counts: { INGEST: 0, SCHEDULE: 0, EXECUTE: 0, RESOLVE: 0 },
    priority_tier: "STANDARD",
    sla_deadline: "2026-08-29T00:00:00.000Z",
    scheduled_start: null,
    scheduled_end: null,
    assigned_operator_id: null,
    reassignment_count: 0,
    case_id: null,
    created_at: "2026-08-20T00:00:00.000Z",
    updated_at: "2026-08-20T00:00:00.000Z",
    last_event_sequence: 0,
    ...overrides,
  };
}

function makeRequest(overrides: Partial<Request> = {}): Request {
  return {
    request_id: "01REQUEST",
    source: "NYC_311",
    external_unique_key: "ext-1",
    location_id: "1234567890",
    complaint_type: "Noise",
    descriptor: null,
    agency: "DSNY",
    raw_payload: {},
    status: "PROMOTED",
    created_by: null,
    created_at: "2026-08-20T00:00:00.000Z",
    ...overrides,
  };
}

function makeLocation(overrides: Partial<Location> = {}): Location {
  return {
    location_id: "1234567890",
    bbl: "1234567890",
    address: "123 Main St",
    borough: "QUEENS",
    community_board: "07 QUEENS",
    zip: "11355",
    latitude: "40.75",
    longitude: "-73.82",
    created_at: "2026-08-20T00:00:00.000Z",
    ...overrides,
  };
}

function makeOrderDao(orders: Order[]): OrderDao {
  return {
    listOrdersWaitingForSchedule: vi.fn().mockResolvedValue({ orders, nextCursor: null }),
    scheduleOrder: vi.fn().mockResolvedValue(undefined),
    recordCaseCreated: vi.fn().mockResolvedValue(undefined),
  } as unknown as OrderDao;
}

function makeRequestDao(request: Request | null): RequestDao {
  return { getRequestById: vi.fn().mockResolvedValue(request) } as unknown as RequestDao;
}

function makeLocationDao(location: Location | null): LocationDao {
  return { getLocation: vi.fn().mockResolvedValue(location) } as unknown as LocationDao;
}

function makeOperatorDao(operatorId = "01OPERATOR"): OperatorDao {
  return { getOperator: vi.fn().mockResolvedValue({ operator_id: operatorId }) } as unknown as OperatorDao;
}

function baseDeps(overrides: OrderSchedulingDeps = {}): OrderSchedulingDeps {
  return {
    orderDao: makeOrderDao([makeOrder()]),
    requestDao: makeRequestDao(makeRequest()),
    locationDao: makeLocationDao(makeLocation()),
    operatorDao: makeOperatorDao(),
    capacityProvider: { getAvailableUnits: vi.fn().mockResolvedValue(5) },
    transitEstimator: { estimateMinutes: vi.fn().mockResolvedValue(20) },
    processingEstimator: { estimateMinutes: vi.fn().mockResolvedValue(30) },
    createCaseFn: vi.fn().mockResolvedValue(undefined),
    now: () => NOW,
    ...overrides,
  };
}

beforeEach(() => {
  ddbMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("scheduleOrders", () => {
  it("schedules an Order when capacity is available, computing the window from transit + processing minutes", async () => {
    const deps = baseDeps();

    const summary = await scheduleOrders(deps);

    expect(summary).toEqual({
      ordersConsidered: 1,
      ordersScheduled: 1,
      ordersSkippedNoCapacity: 0,
      ordersCasedUnroutable: 0,
      ordersFailed: 0,
    });
    expect(deps.orderDao!.scheduleOrder).toHaveBeenCalledWith("01ORDER", {
      scheduledStart: "2026-08-28T12:00:00.000Z",
      scheduledEnd: "2026-08-28T12:50:00.000Z",
      operatorId: "01OPERATOR",
    });
  });

  it("creates a Case and skips dispatch when the Request's agency is null", async () => {
    const deps = baseDeps({ requestDao: makeRequestDao(makeRequest({ agency: null })) });

    const summary = await scheduleOrders(deps);

    expect(summary.ordersCasedUnroutable).toBe(1);
    expect(deps.createCaseFn).toHaveBeenCalledWith(
      expect.objectContaining({ case_type: "WORKFLOW_EXECUTION_FAILURE", order_id: "01ORDER" })
    );
    expect(deps.orderDao!.recordCaseCreated).toHaveBeenCalledWith("01ORDER", expect.any(String));
    expect(deps.orderDao!.scheduleOrder).not.toHaveBeenCalled();
  });

  it("creates a Case and skips dispatch when the Location's borough is null", async () => {
    const deps = baseDeps({ locationDao: makeLocationDao(makeLocation({ borough: null })) });

    const summary = await scheduleOrders(deps);

    expect(summary.ordersCasedUnroutable).toBe(1);
    expect(deps.orderDao!.scheduleOrder).not.toHaveBeenCalled();
  });

  it("creates a Case when the Request record itself is missing (dangling FK)", async () => {
    const deps = baseDeps({ requestDao: makeRequestDao(null) });

    const summary = await scheduleOrders(deps);

    expect(summary.ordersCasedUnroutable).toBe(1);
  });

  it("creates a Case when the Location record itself is missing (dangling FK)", async () => {
    const deps = baseDeps({ locationDao: makeLocationDao(null) });

    const summary = await scheduleOrders(deps);

    expect(summary.ordersCasedUnroutable).toBe(1);
  });

  it("skips without creating a Case when pool capacity is exhausted", async () => {
    const deps = baseDeps({ capacityProvider: { getAvailableUnits: vi.fn().mockResolvedValue(0) } });

    const summary = await scheduleOrders(deps);

    expect(summary.ordersSkippedNoCapacity).toBe(1);
    expect(deps.orderDao!.scheduleOrder).not.toHaveBeenCalled();
    expect(deps.createCaseFn).not.toHaveBeenCalled();
  });

  it("queries capacity once per pool per run, decrementing the in-memory budget across Orders in the same pool", async () => {
    const orders = [makeOrder({ order_id: "01ORDER" }), makeOrder({ order_id: "02ORDER" })];
    const getAvailableUnits = vi.fn().mockResolvedValue(1);
    const deps = baseDeps({ orderDao: makeOrderDao(orders), capacityProvider: { getAvailableUnits } });

    const summary = await scheduleOrders(deps);

    expect(getAvailableUnits).toHaveBeenCalledTimes(1);
    expect(summary.ordersScheduled).toBe(1);
    expect(summary.ordersSkippedNoCapacity).toBe(1);
  });

  it("defaults `now` to the current time when not injected, for a real dispatch that actually calls it", async () => {
    const deps = baseDeps({ now: undefined });

    const summary = await scheduleOrders(deps);

    expect(summary.ordersScheduled).toBe(1);
    expect(deps.orderDao!.scheduleOrder).toHaveBeenCalledWith(
      "01ORDER",
      expect.objectContaining({ scheduledStart: expect.any(String), scheduledEnd: expect.any(String) })
    );
  });

  it("logs a non-Error rejection from a failed dispatch without throwing", async () => {
    const orderDao = makeOrderDao([makeOrder()]);
    (orderDao.scheduleOrder as ReturnType<typeof vi.fn>).mockRejectedValue("string rejection");
    const deps = baseDeps({ orderDao });

    const summary = await scheduleOrders(deps);

    expect(summary.ordersFailed).toBe(1);
  });

  it("isolates a per-order failure — one bad Order doesn't abort the run", async () => {
    const orders = [makeOrder({ order_id: "01ORDER" }), makeOrder({ order_id: "02ORDER" })];
    const orderDao = makeOrderDao(orders);
    (orderDao.scheduleOrder as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("lost the optimistic-lock race"))
      .mockResolvedValueOnce(undefined);
    const deps = baseDeps({ orderDao });

    const summary = await scheduleOrders(deps);

    expect(summary.ordersFailed).toBe(1);
    expect(summary.ordersScheduled).toBe(1);
    expect(summary.ordersConsidered).toBe(2);
  });

  it("pages through listOrdersWaitingForSchedule until the cursor is exhausted", async () => {
    const orderDao = {
      listOrdersWaitingForSchedule: vi
        .fn()
        .mockResolvedValueOnce({ orders: [makeOrder({ order_id: "01ORDER" })], nextCursor: "cursor-1" })
        .mockResolvedValueOnce({ orders: [makeOrder({ order_id: "02ORDER" })], nextCursor: null }),
      scheduleOrder: vi.fn().mockResolvedValue(undefined),
      recordCaseCreated: vi.fn().mockResolvedValue(undefined),
    } as unknown as OrderDao;
    const deps = baseDeps({ orderDao });

    const summary = await scheduleOrders(deps);

    expect(summary.ordersConsidered).toBe(2);
    expect(orderDao.listOrdersWaitingForSchedule).toHaveBeenCalledTimes(2);
    expect(orderDao.listOrdersWaitingForSchedule).toHaveBeenNthCalledWith(2, expect.objectContaining({ cursor: "cursor-1" }));
  });

  it("stops paging at the per-run cap even if more pages remain (defensive bound on Lambda runtime)", async () => {
    let call = 0;
    const listOrdersWaitingForSchedule = vi.fn().mockImplementation(() => {
      call += 1;
      const orders = Array.from({ length: 50 }, (_, i) => makeOrder({ order_id: `page${call}-order${i}` }));
      return Promise.resolve({ orders, nextCursor: `cursor-${call}` });
    });
    const orderDao = {
      listOrdersWaitingForSchedule,
      scheduleOrder: vi.fn().mockResolvedValue(undefined),
      recordCaseCreated: vi.fn().mockResolvedValue(undefined),
    } as unknown as OrderDao;
    const deps = baseDeps({ orderDao });

    const summary = await scheduleOrders(deps);

    expect(summary.ordersConsidered).toBe(200);
    expect(listOrdersWaitingForSchedule).toHaveBeenCalledTimes(4);
  });

  it("defaults every dependency to the module's own instance when not injected", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });

    const summary = await scheduleOrders();

    expect(summary.ordersConsidered).toBe(0);
  });

  it("throws when deps.orderDao is omitted and ORDERS_TABLE_NAME isn't set", async () => {
    const previous = process.env["ORDERS_TABLE_NAME"];
    delete process.env["ORDERS_TABLE_NAME"];

    try {
      await expect(scheduleOrders()).rejects.toThrow("Missing required environment variable: ORDERS_TABLE_NAME");
    } finally {
      if (previous !== undefined) process.env["ORDERS_TABLE_NAME"] = previous;
    }
  });
});
