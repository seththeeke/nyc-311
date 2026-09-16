import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OperatorDao } from "../../../dao/operator/operatorDao";
import { OrderDao, type OperatorOrderActivity } from "../../../dao/order/orderDao";
import { LocationDao } from "../../../dao/location/locationDao";
import { getFleetLocations } from "../../../service/fleet/fleetLocationService";
import type { Operator } from "../../../models/operator";
import type { Order } from "../../../models/order";
import type { Location } from "../../../models/location";
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

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    order_id: "01ORDER",
    request_id: "01REQUEST",
    location_id: "1234567890",
    complaint_type: "Street Condition",
    current_stage: "RESOLVE",
    status: "ACTIVE",
    retry_counts: { INGEST: 0, SCHEDULE: 0, EXECUTE: 0, RESOLVE: 0 },
    priority_tier: "STANDARD",
    sla_deadline: "2026-09-13T00:00:00.000Z",
    scheduled_start: "2026-09-12T01:00:00.000Z",
    scheduled_end: "2026-09-12T02:00:00.000Z",
    assigned_operator_id: "01OPERATOR",
    reassignment_count: 0,
    case_id: null,
    created_at: "2026-09-12T00:00:00.000Z",
    updated_at: "2026-09-12T02:00:00.000Z",
    last_event_sequence: 3,
    ...overrides,
  };
}

function makeLocation(overrides: Partial<Location> = {}): Location {
  return {
    location_id: "1234567890",
    bbl: "1234567890",
    address: "123 Main St",
    borough: "MANHATTAN",
    community_board: "01",
    zip: "10001",
    latitude: "40.75",
    longitude: "-73.99",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeActivity(overrides: Partial<OperatorOrderActivity> = {}): OperatorOrderActivity {
  return { currentOrder: null, recentCompletedOrders: [], ...overrides };
}

function makeNoActivityOrderDao(): OrderDao {
  return { getOperatorOrderActivity: vi.fn().mockResolvedValue(makeActivity()) } as unknown as OrderDao;
}
function makeUnusedLocationDao(): LocationDao {
  return { getLocation: vi.fn() } as unknown as LocationDao;
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

    const result = await getFleetLocations({
      operatorDao: { listActiveRoster } as unknown as OperatorDao,
      orderDao: makeNoActivityOrderDao(),
      locationDao: makeUnusedLocationDao(),
    });

    expect(result).toEqual({
      operators: [
        { operator_id: "01A", name: "Truck A", current_activity: "IDLE", current_location: HOME_DEPOT_LOCATION, recent_job_locations: [], current_order: null },
        {
          operator_id: "01B",
          name: "Truck B",
          current_activity: "WORKING",
          current_location: HOME_DEPOT_LOCATION,
          recent_job_locations: [],
          current_order: null,
        },
      ],
    });
    expect(result.operators[0]).not.toHaveProperty("rate_per_hour");
  });

  it("returns an empty roster when no Operators are active", async () => {
    const listActiveRoster = vi.fn().mockResolvedValue([]);

    await expect(
      getFleetLocations({ operatorDao: { listActiveRoster } as unknown as OperatorDao, orderDao: makeNoActivityOrderDao(), locationDao: makeUnusedLocationDao() })
    ).resolves.toEqual({ operators: [] });
  });

  it("resolves each recent RESOLVE-stage Order's location_id to a GPS point, most-recent-first", async () => {
    const listActiveRoster = vi.fn().mockResolvedValue([makeOperator()]);
    const recentOrders = [makeOrder({ location_id: "LOC1" }), makeOrder({ location_id: "LOC2" })];
    const getOperatorOrderActivity = vi.fn().mockResolvedValue(makeActivity({ recentCompletedOrders: recentOrders }));
    const getLocation = vi
      .fn()
      .mockImplementationOnce(() => Promise.resolve(makeLocation({ location_id: "LOC1", latitude: "40.1", longitude: "-73.1" })))
      .mockImplementationOnce(() => Promise.resolve(makeLocation({ location_id: "LOC2", latitude: "40.2", longitude: "-73.2" })));

    const result = await getFleetLocations({
      operatorDao: { listActiveRoster } as unknown as OperatorDao,
      orderDao: { getOperatorOrderActivity } as unknown as OrderDao,
      locationDao: { getLocation } as unknown as LocationDao,
    });

    expect(result.operators[0].recent_job_locations).toEqual([
      { lat: 40.1, lng: -73.1 },
      { lat: 40.2, lng: -73.2 },
    ]);
    expect(getOperatorOrderActivity).toHaveBeenCalledWith("01OPERATOR");
  });

  it("falls back to HOME_DEPOT_LOCATION for a recent job whose Location has no lat/lng", async () => {
    const listActiveRoster = vi.fn().mockResolvedValue([makeOperator()]);
    const getOperatorOrderActivity = vi.fn().mockResolvedValue(makeActivity({ recentCompletedOrders: [makeOrder()] }));
    const getLocation = vi.fn().mockResolvedValue(makeLocation({ latitude: null, longitude: null }));

    const result = await getFleetLocations({
      operatorDao: { listActiveRoster } as unknown as OperatorDao,
      orderDao: { getOperatorOrderActivity } as unknown as OrderDao,
      locationDao: { getLocation } as unknown as LocationDao,
    });

    expect(result.operators[0].recent_job_locations).toEqual([HOME_DEPOT_LOCATION]);
  });

  it("skips a recent job whose Location record can't be found", async () => {
    const listActiveRoster = vi.fn().mockResolvedValue([makeOperator()]);
    const getOperatorOrderActivity = vi.fn().mockResolvedValue(makeActivity({ recentCompletedOrders: [makeOrder()] }));
    const getLocation = vi.fn().mockResolvedValue(null);

    const result = await getFleetLocations({
      operatorDao: { listActiveRoster } as unknown as OperatorDao,
      orderDao: { getOperatorOrderActivity } as unknown as OrderDao,
      locationDao: { getLocation } as unknown as LocationDao,
    });

    expect(result.operators[0].recent_job_locations).toEqual([]);
  });

  it("builds current_order detail (order id, complaint type, location address) for an Operator with an in-progress EXECUTE Order", async () => {
    const listActiveRoster = vi.fn().mockResolvedValue([makeOperator({ current_activity: "WORKING" })]);
    const currentOrder = makeOrder({ order_id: "01CURRENT", current_stage: "EXECUTE", complaint_type: "Street Condition", location_id: "LOC1" });
    const getOperatorOrderActivity = vi.fn().mockResolvedValue(makeActivity({ currentOrder }));
    const getLocation = vi.fn().mockResolvedValue(makeLocation({ location_id: "LOC1", address: "742 Flatbush Ave" }));

    const result = await getFleetLocations({
      operatorDao: { listActiveRoster } as unknown as OperatorDao,
      orderDao: { getOperatorOrderActivity } as unknown as OrderDao,
      locationDao: { getLocation } as unknown as LocationDao,
    });

    expect(result.operators[0].current_order).toEqual({
      order_id: "01CURRENT",
      complaint_type: "Street Condition",
      location_address: "742 Flatbush Ave",
    });
  });

  it("returns current_order null for an idle Operator with no in-progress Order", async () => {
    const listActiveRoster = vi.fn().mockResolvedValue([makeOperator()]);

    const result = await getFleetLocations({
      operatorDao: { listActiveRoster } as unknown as OperatorDao,
      orderDao: makeNoActivityOrderDao(),
      locationDao: makeUnusedLocationDao(),
    });

    expect(result.operators[0].current_order).toBeNull();
  });

  it("returns current_order null when the in-progress Order's Location record can't be found", async () => {
    const listActiveRoster = vi.fn().mockResolvedValue([makeOperator({ current_activity: "WORKING" })]);
    const currentOrder = makeOrder({ current_stage: "EXECUTE" });
    const getOperatorOrderActivity = vi.fn().mockResolvedValue(makeActivity({ currentOrder }));
    const getLocation = vi.fn().mockResolvedValue(null);

    const result = await getFleetLocations({
      operatorDao: { listActiveRoster } as unknown as OperatorDao,
      orderDao: { getOperatorOrderActivity } as unknown as OrderDao,
      locationDao: { getLocation } as unknown as LocationDao,
    });

    expect(result.operators[0].current_order).toBeNull();
  });

  it("falls back to the module's own default OperatorDao/OrderDao/LocationDao when deps are omitted", async () => {
    const operatorSpy = vi.spyOn(OperatorDao.prototype, "listActiveRoster").mockResolvedValue([]);

    await expect(getFleetLocations()).resolves.toEqual({ operators: [] });

    operatorSpy.mockRestore();
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
