import { getBaseUrl } from "./targets";
import { recordRouteHit, type KnownRoute } from "./routeTracker";

export interface JsonResponse {
  status: number;
  headers: Headers;
  body: unknown;
}

/**
 * Every GET the integration suite makes goes through here, not raw
 * `fetch`, so `routeTracker` sees it regardless of what the caller does
 * with the result afterward — including a test that only checks headers,
 * or one whose later assertions throw.
 */
export async function getJson(route: KnownRoute, pathAndQuery: string, init?: RequestInit): Promise<JsonResponse> {
  const url = `${getBaseUrl()}${pathAndQuery}`;
  const response = await fetch(url, init);
  recordRouteHit(route, response.status);
  const body = await response.json();
  return { status: response.status, headers: response.headers, body };
}
