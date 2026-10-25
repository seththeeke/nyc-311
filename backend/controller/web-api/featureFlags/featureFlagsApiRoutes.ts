/* The featureFlags bundle's route keys (15-resource-consolidation.md §4.2). Imports nothing: cdk/api/Nyc311Api.ts imports it. */
export const FEATURE_FLAGS_API_ROUTES = [
  "GET /feature-flags",
  "GET /feature-flags/{flag_key}",
  "POST /feature-flags/{flag_key}/treatment",
] as const;

export type FeatureFlagsApiRouteKey = (typeof FEATURE_FLAGS_API_ROUTES)[number];
