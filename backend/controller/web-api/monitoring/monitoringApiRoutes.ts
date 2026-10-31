/* The monitoring bundle's route keys (15-resource-consolidation.md §4.2). Imports nothing: cdk/api/Nyc311Api.ts imports it. */
export const MONITORING_API_ROUTES = [
  "GET /ingestion/metrics",
  "GET /lambda-metrics",
  "GET /public-api/metrics",
] as const;

export type MonitoringApiRouteKey = (typeof MONITORING_API_ROUTES)[number];
