import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { arriveAtJob, dispatchOrder, resolveOrder } from "../../../service/execution/orderExecutionService";
import type { OrderDao } from "../../../dao/order/orderDao";
import type { OperatorDao } from "../../../dao/operator/operatorDao";
import type { Operator } from "../../../models/operator";
import { HOME_DEPOT_LOCATION } from "../../../models/gpsLocation";

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

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.SIMULATION_TIME_SCALE;
});

describe("dispatchOrder", () => {
  it("records ORDER_DISPATCHED and scales the wait durations by SIMULATION_TIME_SCALE", async () => {
    process.env.SIMULATION_TIME_SCALE = "100";
    const recordDispatched = vi.fn().mockResolvedValue(undefined);
    const orderDao = { recordDispatched } as unknown as OrderDao;

    const result = await dispatchOrder("01ORDER", 20, 30, { orderDao });

    expect(recordDispatched).toHaveBeenCalledWith("01ORDER");
    expect(result).toEqual({ transit_wait_seconds: 12, processing_wait_seconds: 18 });
  });

  it("defaults the scale to 1 (real time) when SIMULATION_TIME_SCALE is unset", async () => {
    const orderDao = { recordDispatched: vi.fn().mockResolvedValue(undefined) } as unknown as OrderDao;

    const result = await dispatchOrder("01ORDER", 20, 30, { orderDao });

    expect(result).toEqual({ transit_wait_seconds: 1200, processing_wait_seconds: 1800 });
  });

  it("falls back to a scale of 1 for a non-numeric or non-positive SIMULATION_TIME_SCALE", async () => {
    process.env.SIMULATION_TIME_SCALE = "not-a-number";
    const orderDao = { recordDispatched: vi.fn().mockResolvedValue(undefined) } as unknown as OrderDao;

    const result = await dispatchOrder("01ORDER", 20, 30, { orderDao });

    expect(result).toEqual({ transit_wait_seconds: 1200, processing_wait_seconds: 1800 });
  });

  it("throws when deps.orderDao is omitted and ORDERS_TABLE_NAME isn't set", async () => {
    const previous = process.env.ORDERS_TABLE_NAME;
    delete process.env.ORDERS_TABLE_NAME;

    try {
      await expect(dispatchOrder("01ORDER", 20, 30)).rejects.toThrow("Missing required environment variable: ORDERS_TABLE_NAME");
    } finally {
      if (previous !== undefined) process.env.ORDERS_TABLE_NAME = previous;
    }
  });

  it("uses an injected getSimulationTimeScale override instead of the env var", async () => {
    process.env.SIMULATION_TIME_SCALE = "100";
    const orderDao = { recordDispatched: vi.fn().mockResolvedValue(undefined) } as unknown as OrderDao;

    const result = await dispatchOrder("01ORDER", 20, 30, { orderDao, getSimulationTimeScale: () => 10 });

    expect(result).toEqual({ transit_wait_seconds: 120, processing_wait_seconds: 180 });
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
