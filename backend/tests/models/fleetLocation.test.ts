import { describe, expect, it } from "vitest";
import { FleetCurrentOrderSchema, FleetLocationsSchema, FleetOperatorLocationSchema } from "../../models/fleetLocation";
import { HOME_DEPOT_LOCATION } from "../../models/gpsLocation";

const currentOrder = {
  order_id: "01ORDER",
  complaint_type: "Street Condition",
  location_address: "123 Main St",
};

const operator = {
  operator_id: "01OPERATOR",
  name: "Truck 12",
  current_activity: "IDLE",
  current_location: HOME_DEPOT_LOCATION,
  recent_job_locations: [HOME_DEPOT_LOCATION],
  current_order: currentOrder,
};

describe("FleetCurrentOrderSchema", () => {
  it("accepts a well-formed current order", () => {
    expect(FleetCurrentOrderSchema.parse(currentOrder)).toEqual(currentOrder);
  });

  it("accepts null complaint_type and location_address", () => {
    const unknowns = { ...currentOrder, complaint_type: null, location_address: null };
    expect(FleetCurrentOrderSchema.parse(unknowns)).toEqual(unknowns);
  });

  it("rejects a missing order_id", () => {
    const withoutOrderId: Record<string, unknown> = { ...currentOrder };
    delete withoutOrderId.order_id;
    expect(FleetCurrentOrderSchema.safeParse(withoutOrderId).success).toBe(false);
  });
});

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

  it("accepts an empty recent_job_locations array", () => {
    const noRecentJobs = { ...operator, recent_job_locations: [] };
    expect(FleetOperatorLocationSchema.parse(noRecentJobs)).toEqual(noRecentJobs);
  });

  it("rejects a missing recent_job_locations", () => {
    const withoutRecentJobs: Record<string, unknown> = { ...operator };
    delete withoutRecentJobs.recent_job_locations;
    expect(FleetOperatorLocationSchema.safeParse(withoutRecentJobs).success).toBe(false);
  });

  it("accepts a null current_order (idle/between jobs)", () => {
    const idleOperator = { ...operator, current_order: null };
    expect(FleetOperatorLocationSchema.parse(idleOperator)).toEqual(idleOperator);
  });

  it("rejects a missing current_order", () => {
    const withoutCurrentOrder: Record<string, unknown> = { ...operator };
    delete withoutCurrentOrder.current_order;
    expect(FleetOperatorLocationSchema.safeParse(withoutCurrentOrder).success).toBe(false);
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
