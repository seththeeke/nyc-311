import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OperatorDao } from "../../../dao/operator/operatorDao";
import {
  DEFAULT_OPERATOR_RATE_PER_HOUR,
  addCapacity,
  getCapacityStatus,
  removeCapacity,
} from "../../../service/capacity/capacityService";
import { NotFoundError, ValidationError } from "../../../models/errors";
import type { Operator } from "../../../models/operator";
import { HOME_DEPOT_LOCATION } from "../../../models/gpsLocation";

function makeOperator(overrides: Partial<Operator> = {}): Operator {
  return {
    operator_id: "01OPERATOR",
    name: "Truck 12",
    status: "ACTIVE",
    current_activity: "IDLE",
    removal_requested_at: null,
    start_datetime: "2026-09-12T00:00:00.000Z",
    end_datetime: null,
    rate_per_hour: 45,
    current_location: HOME_DEPOT_LOCATION,
    last_event_sequence: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("addCapacity", () => {
  it("falls back to the module's own default OperatorDao when deps.operatorDao is omitted", async () => {
    const spy = vi.spyOn(OperatorDao.prototype, "addOperator").mockResolvedValue(makeOperator());
    await expect(addCapacity("Truck 12", 45)).resolves.toMatchObject({ operator_id: "01OPERATOR" });
    spy.mockRestore();
  });

  it("uses the given name and rate_per_hour when provided", async () => {
    const addOperator = vi.fn().mockResolvedValue(makeOperator({ rate_per_hour: 60 }));

    await addCapacity("Truck 12", 60, { operatorDao: { addOperator } as unknown as OperatorDao });

    expect(addOperator).toHaveBeenCalledWith("Truck 12", 60);
  });

  it("defaults to DEFAULT_OPERATOR_RATE_PER_HOUR when rate_per_hour is omitted", async () => {
    const addOperator = vi.fn().mockResolvedValue(makeOperator());

    await addCapacity("Truck 12", undefined, { operatorDao: { addOperator } as unknown as OperatorDao });

    expect(addOperator).toHaveBeenCalledWith("Truck 12", DEFAULT_OPERATOR_RATE_PER_HOUR);
  });
});

describe("removeCapacity", () => {
  it("throws NotFoundError when the Operator doesn't exist", async () => {
    const getOperator = vi.fn().mockResolvedValue(null);

    await expect(removeCapacity("01MISSING", { operatorDao: { getOperator } as unknown as OperatorDao })).rejects.toThrow(
      NotFoundError
    );
  });

  it("throws ValidationError when the Operator is already removed", async () => {
    const getOperator = vi.fn().mockResolvedValue(makeOperator({ status: "INACTIVE" }));

    await expect(
      removeCapacity("01OPERATOR", { operatorDao: { getOperator } as unknown as OperatorDao })
    ).rejects.toThrow(ValidationError);
  });

  it("returns the Operator unchanged (idempotent) when removal is already queued", async () => {
    const queued = makeOperator({ current_activity: "WORKING", removal_requested_at: "2026-09-12T01:00:00.000Z" });
    const getOperator = vi.fn().mockResolvedValue(queued);
    const finalizeRemoval = vi.fn();
    const queueRemoval = vi.fn();

    const result = await removeCapacity("01OPERATOR", {
      operatorDao: { getOperator, finalizeRemoval, queueRemoval } as unknown as OperatorDao,
    });

    expect(result).toEqual(queued);
    expect(finalizeRemoval).not.toHaveBeenCalled();
    expect(queueRemoval).not.toHaveBeenCalled();
  });

  it("finalizes immediately when the Operator is idle", async () => {
    const getOperator = vi.fn().mockResolvedValue(makeOperator({ current_activity: "IDLE" }));
    const finalized = makeOperator({ status: "INACTIVE", end_datetime: "2026-09-12T02:00:00.000Z" });
    const finalizeRemoval = vi.fn().mockResolvedValue(finalized);

    const result = await removeCapacity("01OPERATOR", {
      operatorDao: { getOperator, finalizeRemoval } as unknown as OperatorDao,
    });

    expect(finalizeRemoval).toHaveBeenCalledWith("01OPERATOR");
    expect(result).toEqual(finalized);
  });

  it("queues removal when the Operator is busy", async () => {
    const getOperator = vi.fn().mockResolvedValue(makeOperator({ current_activity: "TRANSIT" }));
    const queued = makeOperator({ current_activity: "TRANSIT", removal_requested_at: "2026-09-12T02:00:00.000Z" });
    const queueRemoval = vi.fn().mockResolvedValue(queued);

    const result = await removeCapacity("01OPERATOR", {
      operatorDao: { getOperator, queueRemoval } as unknown as OperatorDao,
    });

    expect(queueRemoval).toHaveBeenCalledWith("01OPERATOR");
    expect(result).toEqual(queued);
  });

  it("falls back to the module's own default OperatorDao when deps.operatorDao is omitted", async () => {
    const getSpy = vi.spyOn(OperatorDao.prototype, "getOperator").mockResolvedValue(null);
    await expect(removeCapacity("01MISSING")).rejects.toThrow(NotFoundError);
    getSpy.mockRestore();
  });
});

describe("getCapacityStatus", () => {
  it("computes available_count, fleet_size, and hourly_burn_rate from the active roster", async () => {
    const roster = [
      makeOperator({ operator_id: "01A", current_activity: "IDLE", rate_per_hour: 40 }),
      makeOperator({ operator_id: "01B", current_activity: "WORKING", rate_per_hour: 50 }),
      makeOperator({
        operator_id: "01C",
        current_activity: "IDLE",
        removal_requested_at: "2026-09-12T01:00:00.000Z",
        rate_per_hour: 30,
      }),
    ];
    const listActiveRoster = vi.fn().mockResolvedValue(roster);

    const status = await getCapacityStatus({ operatorDao: { listActiveRoster } as unknown as OperatorDao });

    expect(status).toEqual({
      available_count: 1,
      fleet_size: 3,
      hourly_burn_rate: 120,
      roster,
    });
  });

  it("falls back to the module's own default OperatorDao when deps.operatorDao is omitted", async () => {
    const spy = vi.spyOn(OperatorDao.prototype, "listActiveRoster").mockResolvedValue([]);
    await expect(getCapacityStatus()).resolves.toEqual({
      available_count: 0,
      fleet_size: 0,
      hourly_burn_rate: 0,
      roster: [],
    });
    spy.mockRestore();
  });
});

describe("module wiring", () => {
  it("does not throw on import when OPERATORS_TABLE_NAME is unset (lazy construction, CLAUDE.md §5.2)", async () => {
    const previous = process.env.OPERATORS_TABLE_NAME;
    delete process.env.OPERATORS_TABLE_NAME;
    vi.resetModules();

    await expect(import("../../../service/capacity/capacityService.js")).resolves.toBeDefined();

    process.env.OPERATORS_TABLE_NAME = previous;
    vi.resetModules();
  });

  it("throws only when a service function is actually called without deps.operatorDao and the env var is unset", async () => {
    const previous = process.env.OPERATORS_TABLE_NAME;
    delete process.env.OPERATORS_TABLE_NAME;
    vi.resetModules();
    const { getCapacityStatus: freshGetCapacityStatus } = await import("../../../service/capacity/capacityService.js");

    await expect(freshGetCapacityStatus()).rejects.toThrow("Missing required environment variable: OPERATORS_TABLE_NAME");

    process.env.OPERATORS_TABLE_NAME = previous;
    vi.resetModules();
  });
});
