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
    {
      operator_id: "01MOCKOPERATOR000",
      name: "Vehicle 1",
      current_activity: "IDLE",
      current_location: HOME_DEPOT_LOCATION,
      recent_job_locations: [],
      current_order: null,
    },
    {
      operator_id: "01MOCKOPERATOR001",
      name: "Vehicle 2",
      current_activity: "IDLE",
      current_location: HOME_DEPOT_LOCATION,
      recent_job_locations: [],
      current_order: null,
    },
    {
      operator_id: "01MOCKOPERATOR002",
      name: "Vehicle 3",
      current_activity: "TRANSIT",
      current_location: { lat: 40.6892, lng: -73.9442 },
      recent_job_locations: [{ lat: 40.6821, lng: -73.9553 }],
      current_order: { order_id: "01MOCKORDER000", complaint_type: "Street Condition", location_address: "742 Flatbush Ave, Brooklyn" },
    },
    {
      operator_id: "01MOCKOPERATOR003",
      name: "Vehicle 4",
      current_activity: "WORKING",
      current_location: { lat: 40.6782, lng: -73.9442 },
      /* A full 5-job trail — exercises every fading opacity step (11-street-condition-implementation.md §7). */
      recent_job_locations: [
        { lat: 40.6712, lng: -73.9532 },
        { lat: 40.6655, lng: -73.9608 },
        { lat: 40.6598, lng: -73.9691 },
        { lat: 40.6533, lng: -73.9774 },
        { lat: 40.6471, lng: -73.9852 },
      ],
      current_order: { order_id: "01MOCKORDER001", complaint_type: "Street Condition", location_address: "310 Nostrand Ave, Brooklyn" },
    },
    {
      operator_id: "01MOCKOPERATOR004",
      name: "Vehicle 5",
      current_activity: "WORKING",
      current_location: { lat: 40.7831, lng: -73.9712 },
      recent_job_locations: [],
      current_order: { order_id: "01MOCKORDER002", complaint_type: "Street Condition", location_address: "2 W 96th St, Manhattan" },
    },
    {
      operator_id: "01MOCKOPERATOR005",
      name: "Vehicle 6",
      current_activity: "TRANSIT",
      current_location: { lat: 40.7282, lng: -73.7949 },
      recent_job_locations: [],
      current_order: null,
    },
    {
      operator_id: "01MOCKOPERATOR006",
      name: "Vehicle 7",
      current_activity: "WORKING",
      current_location: { lat: 40.8448, lng: -73.8648 },
      recent_job_locations: [{ lat: 40.8391, lng: -73.8722 }, { lat: 40.8329, lng: -73.8801 }],
      current_order: { order_id: "01MOCKORDER003", complaint_type: "Street Condition", location_address: "888 Grand Concourse, Bronx" },
    },
  ],
};
