import type { FleetLocations } from "../models/fleetLocation";

/*
 * Baked sample data for "mock" data mode (config.ts) — a handful of
 * operators spread across the five boroughs, mixing IDLE (at the depot),
 * TRANSIT, and WORKING so the home-page map has something worth looking
 * at (10-capacity-modeling-and-integration.md §6.1).
 */
const HOME_DEPOT_LOCATION = { lat: 40.7128, lng: -74.006 };

export const MOCK_FLEET_LOCATIONS: FleetLocations = {
  operators: [
    { operator_id: "01MOCKOPERATOR000", name: "Vehicle 1", current_activity: "IDLE", current_location: HOME_DEPOT_LOCATION },
    { operator_id: "01MOCKOPERATOR001", name: "Vehicle 2", current_activity: "IDLE", current_location: HOME_DEPOT_LOCATION },
    {
      operator_id: "01MOCKOPERATOR002",
      name: "Vehicle 3",
      current_activity: "TRANSIT",
      current_location: { lat: 40.6892, lng: -73.9442 },
    },
    {
      operator_id: "01MOCKOPERATOR003",
      name: "Vehicle 4",
      current_activity: "WORKING",
      current_location: { lat: 40.6782, lng: -73.9442 },
    },
    {
      operator_id: "01MOCKOPERATOR004",
      name: "Vehicle 5",
      current_activity: "WORKING",
      current_location: { lat: 40.7831, lng: -73.9712 },
    },
    {
      operator_id: "01MOCKOPERATOR005",
      name: "Vehicle 6",
      current_activity: "TRANSIT",
      current_location: { lat: 40.7282, lng: -73.7949 },
    },
    {
      operator_id: "01MOCKOPERATOR006",
      name: "Vehicle 7",
      current_activity: "WORKING",
      current_location: { lat: 40.8448, lng: -73.8648 },
    },
  ],
};
