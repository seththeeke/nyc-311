import type { FleetOperatorLocation } from "../../../src/models/fleetLocation";

/* Shared Operators for Mapv2's component tests. */
export const WORKING_OPERATOR: FleetOperatorLocation = {
  operator_id: "OP-W",
  name: "Vehicle 4",
  current_activity: "WORKING",
  current_location: { lat: 40.6782, lng: -73.9442 },
  recent_job_locations: [{ lat: 40.6712, lng: -73.9532 }],
  current_order: { order_id: "ORDER-1", complaint_type: "Street Condition", location_address: "310 Nostrand Ave, Brooklyn" },
};

export const IDLE_OPERATOR: FleetOperatorLocation = {
  operator_id: "OP-I",
  name: "Vehicle 1",
  current_activity: "IDLE",
  current_location: { lat: 40.7128, lng: -74.006 },
  recent_job_locations: [],
  current_order: null,
};

export const NO_GPS_OPERATOR: FleetOperatorLocation = { ...IDLE_OPERATOR, operator_id: "OP-N", name: "Vehicle 9", current_location: null };
