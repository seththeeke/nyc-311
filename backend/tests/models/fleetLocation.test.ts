import { describe, expect, it } from "vitest";
import { FleetLocationsSchema, FleetOperatorLocationSchema } from "../../models/fleetLocation";
import { HOME_DEPOT_LOCATION } from "../../models/gpsLocation";

const operator = {
  operator_id: "01OPERATOR",
  name: "Truck 12",
  current_activity: "IDLE",
  current_location: HOME_DEPOT_LOCATION,
};

describe("FleetOperatorLocationSchema", () => {
  it("accepts a well-formed fleet operator", () => {
    expect(FleetOperatorLocationSchema.parse(operator)).toEqual(operator);
  });

  it("accepts a null current_location", () => {
    const noLocation = { ...operator, current_location: null };
    expect(FleetOperatorLocationSchema.parse(noLocation)).toEqual(noLocation);
  });

  it("rejects an unknown current_activity", () => {
    expect(FleetOperatorLocationSchema.safeParse({ ...operator, current_activity: "OFF_SHIFT" }).success).toBe(false);
  });

  it("rejects a missing name", () => {
    const withoutName: Record<string, unknown> = { ...operator };
    delete withoutName.name;
    expect(FleetOperatorLocationSchema.safeParse(withoutName).success).toBe(false);
  });
});

describe("FleetLocationsSchema", () => {
  it("accepts a well-formed roster", () => {
    const locations = { operators: [operator] };
    expect(FleetLocationsSchema.parse(locations)).toEqual(locations);
  });

  it("accepts an empty roster", () => {
    expect(FleetLocationsSchema.parse({ operators: [] })).toEqual({ operators: [] });
  });
});
