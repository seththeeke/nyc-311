/* The public API's route keys (16-resident-action-models.md §2.4). Imports nothing: cdk/api/Nyc311PublicApi.ts imports it. The spec's paths must match exactly. */
export const PUBLIC_V1_API_ROUTES = [
  "POST /v1/requests/search",
  "POST /v1/feature-requests",
  "GET /v1/feature-requests/{feature_request_id}",
  "GET /v1/openapi.yaml",
] as const;

export type PublicV1ApiRouteKey = (typeof PUBLIC_V1_API_ROUTES)[number];
