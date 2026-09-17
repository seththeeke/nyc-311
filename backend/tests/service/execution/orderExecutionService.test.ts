import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { arriveAtJob, dispatchOrder, resolveOrder } from "../../../service/execution/orderExecutionService";
import type { OrderDao } from "../../../dao/order/orderDao";
import type { OperatorDao } from "../../../dao/operator/operatorDao";
import type { RequestDao } from "../../../dao/request/requestDao";
import type { Operator } from "../../../models/operator";
import type { Order } from "../../../models/order";
import type { Request } from "../../../models/request";
import type { TransitTimeEstimator } from "../../../service/scheduling/transitTimeService";
import type { ProcessingTimeEstimator } from "../../../service/scheduling/processingTimeService";
import { HOME_DEPOT_LOCATION } from "../../../models/gpsLocation";

const JOB_LOCATION = { lat: 40.75, lng: -73.98 };

function makeOperator(overrides: Partial<Operator> = {}): Operator {
  return {
    operator_id: "01OPERATOR",
    name: "Truck 12",
    status: "ACTIVE",
    current_activity: "WORKING",
    removal_requested_at: null,
    start_datetime: "2026-09-12T00:00:00.000Z",
    end_datetime: null,
    rate_per_hour: 45,
    current_location: HOME_DEPOT_LOCATION,
    last_event_sequence: 2,
    ...overrides,
  };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    order_id: "01ORDER",
    request_id: "01REQUEST",
    location_id: "1234567890",
    complaint_type: "Street Condition",
    current_stage: "EXECUTE",
    status: "ACTIVE",
    retry_counts: { INGEST: 0, SCHEDULE: 0, EXECUTE: 0, RESOLVE: 0 },
    priority_tier: "STANDARD",
    sla_deadline: "2026-08-29T00:00:00.000Z",
    scheduled_start: "2026-08-28T12:00:00.000Z",
    scheduled_end: "2026-08-28T12:50:00.000Z",
    assigned_operator_id: "01OPERATOR",
    reassignment_count: 0,
    case_id: null,
    created_at: "2026-08-20T00:00:00.000Z",
    updated_at: "2026-08-20T00:00:00.000Z",
    last_event_sequence: 1,
    ...overrides,
  };
}

function makeRequest(overrides: Partial<Request> = {}): Request {
  return {
    request_id: "01REQUEST",
    source: "NYC_311",
    external_unique_key: "ext-1",
    location_id: "1234567890",
    complaint_type: "Street Condition",
    descriptor: null,
    agency: "DOT",
    raw_payload: {},
    status: "PROMOTED",
    created_by: null,
    created_at: "2026-08-20T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.SIMULATION_TIME_SCALE;
});

describe("dispatchOrder", () => {
  function makeDeps(overrides: {
    order?: Order;
    operator?: Operator | null;
    request?: Request | null;
    estimatedTransitMinutes?: number;
    estimatedProcessingMinutes?: number;
    randomValues?: number[];
  } = {}): {
    orderDao: OrderDao;
    operatorDao: OperatorDao;
    requestDao: RequestDao;
    transitEstimator: TransitTimeEstimator;
    processingEstimator: ProcessingTimeEstimator;
    random: () => number;
  } {
    const order = overrides.order ?? makeOrder();
    const operator = overrides.operator === undefined ? makeOperator() : overrides.operator;
    const request = overrides.request === undefined ? makeRequest() : overrides.request;
    const random = vi.fn();
    for (const value of overrides.randomValues ?? [0.5, 0.5]) {
      random.mockReturnValueOnce(value);
    }
    return {
      orderDao: { recordDispatched: vi.fn().mockResolvedValue(order) } as unknown as OrderDao,
      operatorDao: { getOperator: vi.fn().mockResolvedValue(operator) } as unknown as OperatorDao,
      requestDao: { getRequestById: vi.fn().mockResolvedValue(request) } as unknown as RequestDao,
      transitEstimator: { estimateMinutes: vi.fn().mockResolvedValue(overrides.estimatedTransitMinutes ?? 10) },
      processingEstimator: { estimateMinutes: vi.fn().mockResolvedValue(overrides.estimatedProcessingMinutes ?? 40) },
      random,
    };
  }

  it("records ORDER_DISPATCHED, re-estimates transit and processing live, and scales both wait durations by SIMULATION_TIME_SCALE", async () => {
    process.env.SIMULATION_TIME_SCALE = "100";
    const deps = makeDeps({ estimatedTransitMinutes: 10, estimatedProcessingMinutes: 40, randomValues: [0.5, 0.5] });

    const result = await dispatchOrder("01ORDER", "01OPERATOR", JOB_LOCATION, deps);

    expect(deps.orderDao.recordDispatched).toHaveBeenCalledWith("01ORDER");
    expect(deps.requestDao.getRequestById).toHaveBeenCalledWith("01REQUEST");
    /* estimated 10 * factor 1.5 = 15 transit minutes -> 900s / scale 100 = 9; estimated 40 * factor 1.5 = 60 processing minutes -> 3600s / 100 = 36 */
    expect(result).toEqual({ transit_wait_seconds: 9, processing_wait_seconds: 36 });
  });

  it("calls the transit estimator with the Operator's position and the processing estimator with the Order/Request", async () => {
    const operator = makeOperator({ current_location: { lat: 40.6, lng: -74.1 } });
    const order = makeOrder();
    const request = makeRequest();
    const deps = makeDeps({ operator, order, request });

    await dispatchOrder("01ORDER", "01OPERATOR", JOB_LOCATION, deps);

    expect(deps.operatorDao.getOperator).toHaveBeenCalledWith("01OPERATOR");
    expect(deps.transitEstimator.estimateMinutes).toHaveBeenCalledWith({ lat: 40.6, lng: -74.1 }, JOB_LOCATION);
    expect(deps.processingEstimator.estimateMinutes).toHaveBeenCalledWith(order, request);
  });

  it("draws an independent random factor for processing than for transit", async () => {
    process.env.SIMULATION_TIME_SCALE = "1";
    const deps = makeDeps({ estimatedTransitMinutes: 10, estimatedProcessingMinutes: 10, randomValues: [0, 0.5] });

    const result = await dispatchOrder("01ORDER", "01OPERATOR", JOB_LOCATION, deps);

    /* transit: factor 1 -> 10min -> 600s; processing: factor 1.5 -> 15min -> 900s */
    expect(result).toEqual({ transit_wait_seconds: 600, processing_wait_seconds: 900 });
  });

  it("falls back to HOME_DEPOT_LOCATION for the Operator's position when the Operator can't be found", async () => {
    const deps = makeDeps({ operator: null });

    await dispatchOrder("01ORDER", "01OPERATOR", JOB_LOCATION, deps);

    expect(deps.transitEstimator.estimateMinutes).toHaveBeenCalledWith(HOME_DEPOT_LOCATION, JOB_LOCATION);
  });

  it("falls back to HOME_DEPOT_LOCATION for the Operator's position when current_location is null", async () => {
    const deps = makeDeps({ operator: makeOperator({ current_location: null }) });

    await dispatchOrder("01ORDER", "01OPERATOR", JOB_LOCATION, deps);

    expect(deps.transitEstimator.estimateMinutes).toHaveBeenCalledWith(HOME_DEPOT_LOCATION, JOB_LOCATION);
  });

  it("throws when the Order's Request can't be resolved", async () => {
    const deps = makeDeps({ request: null });

    await expect(dispatchOrder("01ORDER", "01OPERATOR", JOB_LOCATION, deps)).rejects.toThrow(
      "Order 01ORDER has no resolvable Request record"
    );
  });

  it("defaults the scale to 1 (real time) when SIMULATION_TIME_SCALE is unset", async () => {
    const deps = makeDeps({ estimatedTransitMinutes: 10, estimatedProcessingMinutes: 40 });

    const result = await dispatchOrder("01ORDER", "01OPERATOR", JOB_LOCATION, deps);

    expect(result).toEqual({ transit_wait_seconds: 900, processing_wait_seconds: 3600 });
  });

  it("falls back to a scale of 1 for a non-numeric or non-positive SIMULATION_TIME_SCALE", async () => {
    process.env.SIMULATION_TIME_SCALE = "not-a-number";
    const deps = makeDeps({ estimatedTransitMinutes: 10, estimatedProcessingMinutes: 40 });

    const result = await dispatchOrder("01ORDER", "01OPERATOR", JOB_LOCATION, deps);

    expect(result).toEqual({ transit_wait_seconds: 900, processing_wait_seconds: 3600 });
  });

  it("throws when deps.orderDao is omitted and ORDERS_TABLE_NAME isn't set", async () => {
    const previous = process.env.ORDERS_TABLE_NAME;
    delete process.env.ORDERS_TABLE_NAME;

    try {
      await expect(dispatchOrder("01ORDER", "01OPERATOR", JOB_LOCATION)).rejects.toThrow(
        "Missing required environment variable: ORDERS_TABLE_NAME"
      );
    } finally {
      if (previous !== undefined) process.env.ORDERS_TABLE_NAME = previous;
    }
  });

  it("throws when deps.operatorDao is omitted and OPERATORS_TABLE_NAME isn't set", async () => {
    const previous = process.env.OPERATORS_TABLE_NAME;
    delete process.env.OPERATORS_TABLE_NAME;
    const orderDao = { recordDispatched: vi.fn().mockResolvedValue(makeOrder()) } as unknown as OrderDao;

    try {
      await expect(dispatchOrder("01ORDER", "01OPERATOR", JOB_LOCATION, { orderDao })).rejects.toThrow(
        "Missing required environment variable: OPERATORS_TABLE_NAME"
      );
    } finally {
      if (previous !== undefined) process.env.OPERATORS_TABLE_NAME = previous;
    }
  });

  it("throws when deps.requestDao is omitted and REQUESTS_TABLE_NAME isn't set", async () => {
    const previous = process.env.REQUESTS_TABLE_NAME;
    delete process.env.REQUESTS_TABLE_NAME;
    const orderDao = { recordDispatched: vi.fn().mockResolvedValue(makeOrder()) } as unknown as OrderDao;
    const operatorDao = { getOperator: vi.fn().mockResolvedValue(makeOperator()) } as unknown as OperatorDao;

    try {
      await expect(dispatchOrder("01ORDER", "01OPERATOR", JOB_LOCATION, { orderDao, operatorDao })).rejects.toThrow(
        "Missing required environment variable: REQUESTS_TABLE_NAME"
      );
    } finally {
      if (previous !== undefined) process.env.REQUESTS_TABLE_NAME = previous;
    }
  });

  it("falls back to the real transit/processing estimators and Math.random when none are injected", async () => {
    const orderDao = { recordDispatched: vi.fn().mockResolvedValue(makeOrder()) } as unknown as OrderDao;
    const operatorDao = { getOperator: vi.fn().mockResolvedValue(makeOperator()) } as unknown as OperatorDao;
    const requestDao = { getRequestById: vi.fn().mockResolvedValue(makeRequest()) } as unknown as RequestDao;

    const result = await dispatchOrder("01ORDER", "01OPERATOR", JOB_LOCATION, { orderDao, operatorDao, requestDao });

    expect(Number.isInteger(result.transit_wait_seconds)).toBe(true);
    expect(Number.isInteger(result.processing_wait_seconds)).toBe(true);
    expect(result.transit_wait_seconds).toBeGreaterThan(0);
    expect(result.processing_wait_seconds).toBeGreaterThan(0);
  });

  it("uses an injected getSimulationTimeScale override instead of the env var", async () => {
    process.env.SIMULATION_TIME_SCALE = "100";
    const deps = makeDeps({ estimatedTransitMinutes: 10, estimatedProcessingMinutes: 40 });

    const result = await dispatchOrder("01ORDER", "01OPERATOR", JOB_LOCATION, {
      ...deps,
      getSimulationTimeScale: () => 10,
    });

    expect(result).toEqual({ transit_wait_seconds: 90, processing_wait_seconds: 360 });
  });
});

describe("arriveAtJob", () => {
  it("records ORDER_ARRIVED, starts Operator work at the job location, then records ORDER_PROCESSING", async () => {
    const recordArrived = vi.fn().mockResolvedValue(undefined);
    const recordProcessing = vi.fn().mockResolvedValue(undefined);
    const startWork = vi.fn().mockResolvedValue(makeOperator());
    const orderDao = { recordArrived, recordProcessing } as unknown as OrderDao;
    const operatorDao = { startWork } as unknown as OperatorDao;
    const jobLocation = { lat: 40.75, lng: -73.98 };

    await arriveAtJob("01ORDER", "01OPERATOR", jobLocation, { orderDao, operatorDao });

    expect(recordArrived).toHaveBeenCalledWith("01ORDER");
    expect(startWork).toHaveBeenCalledWith("01OPERATOR", jobLocation);
    expect(recordProcessing).toHaveBeenCalledWith("01ORDER");
  });

  it("throws when deps.orderDao is omitted and ORDERS_TABLE_NAME isn't set", async () => {
    const previous = process.env.ORDERS_TABLE_NAME;
    delete process.env.ORDERS_TABLE_NAME;

    try {
      await expect(arriveAtJob("01ORDER", "01OPERATOR", { lat: 40.75, lng: -73.98 })).rejects.toThrow(
        "Missing required environment variable: ORDERS_TABLE_NAME"
      );
    } finally {
      if (previous !== undefined) process.env.ORDERS_TABLE_NAME = previous;
    }
  });
});

describe("resolveOrder", () => {
  it("records ORDER_RESOLVED and completes the Operator's work", async () => {
    const recordResolved = vi.fn().mockResolvedValue(undefined);
    const completeWork = vi.fn().mockResolvedValue(makeOperator({ current_activity: "IDLE" }));
    const finalizeRemoval = vi.fn();
    const orderDao = { recordResolved } as unknown as OrderDao;
    const operatorDao = { completeWork, finalizeRemoval } as unknown as OperatorDao;

    await resolveOrder("01ORDER", "01OPERATOR", { orderDao, operatorDao });

    expect(recordResolved).toHaveBeenCalledWith("01ORDER");
    expect(completeWork).toHaveBeenCalledWith("01OPERATOR");
    expect(finalizeRemoval).not.toHaveBeenCalled();
  });

  it("finalizes a queued removal when the Operator's removal_requested_at was set", async () => {
    const completeWork = vi.fn().mockResolvedValue(
      makeOperator({ current_activity: "IDLE", removal_requested_at: "2026-09-12T01:00:00.000Z" })
    );
    const finalizeRemoval = vi.fn().mockResolvedValue(undefined);
    const orderDao = { recordResolved: vi.fn().mockResolvedValue(undefined) } as unknown as OrderDao;
    const operatorDao = { completeWork, finalizeRemoval } as unknown as OperatorDao;

    await resolveOrder("01ORDER", "01OPERATOR", { orderDao, operatorDao });

    expect(finalizeRemoval).toHaveBeenCalledWith("01OPERATOR");
  });

  it("throws when deps.orderDao is omitted and ORDERS_TABLE_NAME isn't set", async () => {
    const previous = process.env.ORDERS_TABLE_NAME;
    delete process.env.ORDERS_TABLE_NAME;

    try {
      await expect(resolveOrder("01ORDER", "01OPERATOR")).rejects.toThrow(
        "Missing required environment variable: ORDERS_TABLE_NAME"
      );
    } finally {
      if (previous !== undefined) process.env.ORDERS_TABLE_NAME = previous;
    }
  });

  it("throws when deps.operatorDao is omitted and OPERATORS_TABLE_NAME isn't set", async () => {
    const previous = process.env.OPERATORS_TABLE_NAME;
    delete process.env.OPERATORS_TABLE_NAME;
    const orderDao = { recordResolved: vi.fn().mockResolvedValue(undefined) } as unknown as OrderDao;

    try {
      await expect(resolveOrder("01ORDER", "01OPERATOR", { orderDao })).rejects.toThrow(
        "Missing required environment variable: OPERATORS_TABLE_NAME"
      );
    } finally {
      if (previous !== undefined) process.env.OPERATORS_TABLE_NAME = previous;
    }
  });
});
