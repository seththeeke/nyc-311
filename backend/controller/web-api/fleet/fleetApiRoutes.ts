/* The fleet bundle's route keys (15-resource-consolidation.md §4.2). Imports nothing: cdk/api/Nyc311Api.ts imports it. */
export const FLEET_API_ROUTES = [
  "GET /fleet/locations",
] as const;

export type FleetApiRouteKey = (typeof FLEET_API_ROUTES)[number];
