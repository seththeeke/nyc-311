import { z } from "zod";

/*
 * What every /v1/ call carries through the router and records about itself
 * (16-resident-action-models.md §2.2, §4). The public_api_calls warehouse
 * row is built from it.
 */

export const PUBLIC_API_OPERATIONS = ["SEARCH_REQUESTS", "CREATE_FEATURE_REQUEST", "GET_FEATURE_REQUEST", "GET_OPENAPI_SPEC", "UNKNOWN"] as const;
export type PublicApiOperation = (typeof PUBLIC_API_OPERATIONS)[number];

export const PUBLIC_API_OUTCOMES = ["SUCCESS", "CLIENT_ERROR", "SERVER_ERROR"] as const;
export type PublicApiOutcome = (typeof PUBLIC_API_OUTCOMES)[number];

/* A requester that's missing or malformed is recorded as this. */
export const UNKNOWN_REQUESTER = "UNKNOWN";

/* Handed to every public controller by the router. */
export interface PublicCallContext {
  call_id: string;
  requester: string;
}

/* What a controller reports for the usage row; filters only, never free text. */
export interface PublicApiUsage {
  request_params: string | null;
  result_count: number | null;
  resource_id: string | null;
}

/* A controller's result; the router turns it into the HTTP response. A string body is sent as-is. */
export interface PublicApiResult {
  status_code: number;
  body: unknown;
  content_type?: string;
  usage: PublicApiUsage;
}

export const PublicApiCallSchema = z.object({
  call_id: z.string().min(1),
  requester: z.string().min(1),
  operation: z.enum(PUBLIC_API_OPERATIONS),
  route_key: z.string().min(1),
  status_code: z.number().int(),
  outcome: z.enum(PUBLIC_API_OUTCOMES),
  latency_ms: z.number().int().nonnegative(),
  request_params: z.string().nullable(),
  result_count: z.number().int().nonnegative().nullable(),
  resource_id: z.string().nullable(),
  occurred_at: z.string().min(1),
});
export type PublicApiCall = z.infer<typeof PublicApiCallSchema>;
