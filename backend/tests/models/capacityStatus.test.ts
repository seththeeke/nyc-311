import { describe, expect, it } from "vitest";
import { CapacityStatusSchema } from "../../models/capacityStatus";
import { HOME_DEPOT_LOCATION } from "../../models/gpsLocation";

const operator = {
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
};

describe("CapacityStatusSchema", () => {
  it("accepts a well-formed CapacityStatus", () => {
    const status = { available_count: 1, fleet_size: 1, hourly_burn_rate: 45, roster: [operator] };
    expect(CapacityStatusSchema.parse(status)).toEqual(status);
  });

  it("accepts an empty roster", () => {
    const status = { available_count: 0, fleet_size: 0, hourly_burn_rate: 0, roster: [] };
    expect(CapacityStatusSchema.parse(status)).toEqual(status);
  });

  it("rejects a negative available_count", () => {
    const status = { available_count: -1, fleet_size: 0, hourly_burn_rate: 0, roster: [] };
    expect(CapacityStatusSchema.safeParse(status).success).toBe(false);
  });

  it("rejects a roster item that fails OperatorSchema", () => {
    const status = { available_count: 0, fleet_size: 1, hourly_burn_rate: 0, roster: [{ operator_id: "x" }] };
    expect(CapacityStatusSchema.safeParse(status).success).toBe(false);
  });
});
