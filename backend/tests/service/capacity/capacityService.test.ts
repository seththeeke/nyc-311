import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OperatorDao } from "../../../dao/operator/operatorDao";
import {
  DEFAULT_OPERATOR_RATE_PER_HOUR,
  addCapacity,
  getCapacityLimits,
  getCapacityStatus,
  removeCapacity,
} from "../../../service/capacity/capacityService";
import { ConflictError, NotFoundError, ValidationError } from "../../../models/errors";
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

/* 2026-11-01 10:00 in New York. */
const NOW = new Date("2026-11-01T14:00:00.000Z");
const LIMITS_NONE = { max_recruits_per_day: 2, max_releases_per_day: 2, recruits_today: 0, releases_today: 0, day: "2026-11-01", day_resets_at: "2026-11-02 00:00 America/New_York" };
const AGENT = { actor: "AGENT" as const, reason: "Median 2.6 days", by: "coo-agent@agents.boroughsim.com" };

describe("getCapacityLimits and the COO's caps", () => {
  const today = "2026-11-01T13:00:00.000Z";
  const yesterday = "2026-10-31T13:00:00.000Z";
  const roster = [
    makeOperator({ operator_id: "R1", added_by: "AGENT", start_datetime: today }),
    makeOperator({ operator_id: "R2", added_by: "AGENT", start_datetime: yesterday }),
    makeOperator({ operator_id: "R3", added_by: "ADMIN", start_datetime: today }),
    makeOperator({ operator_id: "R4", status: "INACTIVE", released_by: "AGENT", released_at: today }),
    makeOperator({ operator_id: "R5", released_by: "AGENT", released_at: today }),
    makeOperator({ operator_id: "R6", released_by: "ADMIN", released_at: today }),
  ];

  it("counts only the agent's recruits and releases on today's New York date", async () => {
    const limits = await getCapacityLimits({ operatorDao: { listRoster: vi.fn().mockResolvedValue(roster) } as unknown as OperatorDao, now: () => NOW });
    expect(limits).toEqual({ ...LIMITS_NONE, recruits_today: 1, releases_today: 2 });
  });

  it("refuses an agent's release past the cap with ConflictError, but never the admin", async () => {
    const operatorDao = { listRoster: vi.fn().mockResolvedValue(roster), getOperator: vi.fn().mockResolvedValue(makeOperator()), finalizeRemoval: vi.fn().mockResolvedValue(makeOperator()) } as unknown as OperatorDao;
    await expect(removeCapacity("01OPERATOR", { operatorDao, now: () => NOW }, AGENT)).rejects.toThrow("Daily release limit reached: 2 of 2 today");
    await expect(removeCapacity("01OPERATOR", { operatorDao, now: () => NOW })).resolves.toBeDefined();
  });

  it("lets an agent recruit under the cap, stamping the change, and refuses past it", async () => {
    const addOperator = vi.fn().mockResolvedValue(makeOperator());
    const under = { listRoster: vi.fn().mockResolvedValue(roster), addOperator } as unknown as OperatorDao;
    await addCapacity("Truck 13", undefined, { operatorDao: under, now: () => NOW }, AGENT);
    expect(addOperator).toHaveBeenCalledWith("Truck 13", DEFAULT_OPERATOR_RATE_PER_HOUR, AGENT);
    const full = { listRoster: vi.fn().mockResolvedValue([...roster, makeOperator({ operator_id: "R7", added_by: "AGENT", start_datetime: today })]), addOperator } as unknown as OperatorDao;
    await expect(addCapacity("Truck 14", undefined, { operatorDao: full, now: () => NOW }, AGENT)).rejects.toBeInstanceOf(ConflictError);
  });

  it("uses the real clock and DAO by default", async () => {
    const spy = vi.spyOn(OperatorDao.prototype, "listRoster").mockResolvedValue([]);
    await expect(getCapacityLimits()).resolves.toMatchObject({ recruits_today: 0, releases_today: 0 });
    spy.mockRestore();
  });
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

    expect(addOperator).toHaveBeenCalledWith("Truck 12", 60, { actor: "ADMIN", reason: null, by: null });
  });

  it("defaults to DEFAULT_OPERATOR_RATE_PER_HOUR when rate_per_hour is omitted", async () => {
    const addOperator = vi.fn().mockResolvedValue(makeOperator());

    await addCapacity("Truck 12", undefined, { operatorDao: { addOperator } as unknown as OperatorDao });

    expect(addOperator).toHaveBeenCalledWith("Truck 12", DEFAULT_OPERATOR_RATE_PER_HOUR, { actor: "ADMIN", reason: null, by: null });
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

    expect(finalizeRemoval).toHaveBeenCalledWith("01OPERATOR", { actor: "ADMIN", reason: null, by: null });
    expect(result).toEqual(finalized);
  });

  it("queues removal when the Operator is busy", async () => {
    const getOperator = vi.fn().mockResolvedValue(makeOperator({ current_activity: "TRANSIT" }));
    const queued = makeOperator({ current_activity: "TRANSIT", removal_requested_at: "2026-09-12T02:00:00.000Z" });
    const queueRemoval = vi.fn().mockResolvedValue(queued);

    const result = await removeCapacity("01OPERATOR", {
      operatorDao: { getOperator, queueRemoval } as unknown as OperatorDao,
    });

    expect(queueRemoval).toHaveBeenCalledWith("01OPERATOR", { actor: "ADMIN", reason: null, by: null });
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
    const listRoster = vi.fn().mockResolvedValue(roster);

    const status = await getCapacityStatus({ operatorDao: { listActiveRoster, listRoster } as unknown as OperatorDao, now: () => NOW });

    expect(status).toEqual({
      available_count: 1,
      fleet_size: 3,
      hourly_burn_rate: 120,
      roster,
      limits: LIMITS_NONE,
    });
  });

  it("falls back to the module's own default OperatorDao when deps.operatorDao is omitted", async () => {
    const spy = vi.spyOn(OperatorDao.prototype, "listActiveRoster").mockResolvedValue([]);
    const rosterSpy = vi.spyOn(OperatorDao.prototype, "listRoster").mockResolvedValue([]);
    await expect(getCapacityStatus()).resolves.toMatchObject({ available_count: 0, fleet_size: 0, hourly_burn_rate: 0, roster: [], limits: { recruits_today: 0 } });
    spy.mockRestore();
    rosterSpy.mockRestore();
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
