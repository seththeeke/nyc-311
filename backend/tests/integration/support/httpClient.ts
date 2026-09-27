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

/**
 * Same route tracking as {@link getJson}, for a non-GET call. Tolerates an
 * empty response body (e.g. a `204` from a DELETE), returning `null` for it.
 */
export async function sendJson(
  route: KnownRoute,
  pathAndQuery: string,
  method: "POST" | "PUT" | "DELETE",
  options: { body?: unknown; headers?: Record<string, string> } = {}
): Promise<JsonResponse> {
  const url = `${getBaseUrl()}${pathAndQuery}`;
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  recordRouteHit(route, response.status);
  const text = await response.text();
  return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : null };
}
