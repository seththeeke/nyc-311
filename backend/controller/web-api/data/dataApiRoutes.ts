/* The data bundle's route keys (15-resource-consolidation.md §4.2). Imports nothing: cdk/api/Nyc311Api.ts imports it. */
export const DATA_API_ROUTES = [
  "GET /data/schema",
  "GET /workspace/metrics",
] as const;

export type DataApiRouteKey = (typeof DATA_API_ROUTES)[number];
