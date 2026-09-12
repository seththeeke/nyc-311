import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OperatorDao } from "../../../dao/operator/operatorDao";
import { getFleetLocations } from "../../../service/fleet/fleetLocationService";
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

describe("getFleetLocations", () => {
  it("maps the active roster to the public-safe subset, dropping rate_per_hour and other admin-only fields", async () => {
    const roster = [makeOperator({ operator_id: "01A", name: "Truck A" }), makeOperator({ operator_id: "01B", name: "Truck B", current_activity: "WORKING" })];
    const listActiveRoster = vi.fn().mockResolvedValue(roster);

    const result = await getFleetLocations({ operatorDao: { listActiveRoster } as unknown as OperatorDao });

    expect(result).toEqual({
      operators: [
        { operator_id: "01A", name: "Truck A", current_activity: "IDLE", current_location: HOME_DEPOT_LOCATION },
        { operator_id: "01B", name: "Truck B", current_activity: "WORKING", current_location: HOME_DEPOT_LOCATION },
      ],
    });
    expect(result.operators[0]).not.toHaveProperty("rate_per_hour");
  });

  it("returns an empty roster when no Operators are active", async () => {
    const listActiveRoster = vi.fn().mockResolvedValue([]);

    await expect(getFleetLocations({ operatorDao: { listActiveRoster } as unknown as OperatorDao })).resolves.toEqual({
      operators: [],
    });
  });

  it("falls back to the module's own default OperatorDao when deps.operatorDao is omitted", async () => {
    const spy = vi.spyOn(OperatorDao.prototype, "listActiveRoster").mockResolvedValue([]);

    await expect(getFleetLocations()).resolves.toEqual({ operators: [] });

    spy.mockRestore();
  });

  it("throws when deps.operatorDao is omitted and OPERATORS_TABLE_NAME isn't set", async () => {
    const previous = process.env.OPERATORS_TABLE_NAME;
    delete process.env.OPERATORS_TABLE_NAME;

    try {
      await expect(getFleetLocations()).rejects.toThrow("Missing required environment variable: OPERATORS_TABLE_NAME");
    } finally {
      if (previous !== undefined) process.env.OPERATORS_TABLE_NAME = previous;
    }
  });
});
