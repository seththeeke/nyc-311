import { lookupStackOutput } from "./cfnOutputs";
import { recordRouteHit, type KnownRoute } from "./routeTracker";

/*
 * The public API (16-resident-action-models.md §2) has its own host, so its
 * base URL is resolved separately from targets.ts's: PUBLIC_API_BASE_URL in
 * the pipeline, else the stack's Nyc311PublicApiUrl output.
 */

const STACK_NAME_BY_TARGET: Record<string, string> = { test: "Nyc311-Test", prod: "Nyc311-Prod" };

let cachedBaseUrl: string | undefined;

function publicApiBaseUrl(): string {
  if (cachedBaseUrl) return cachedBaseUrl;
  const target = process.env.INTEGRATION_TARGET ?? "";
  const stackName = STACK_NAME_BY_TARGET[target];
  if (!process.env.PUBLIC_API_BASE_URL && !stackName) {
    throw new Error(`The public API has no local target — INTEGRATION_TARGET is ${JSON.stringify(target)}`);
  }
  cachedBaseUrl = (process.env.PUBLIC_API_BASE_URL ?? lookupStackOutput(stackName, "Nyc311PublicApiUrl")).replace(/\/$/, "");
  return cachedBaseUrl;
}

export interface PublicApiResponse {
  status: number;
  headers: Headers;
  text: string;
  /* The parsed body, or null when it isn't JSON (the YAML spec). */
  json: unknown;
}

/** One call to the public API, tracked in the route report like every other integration call. */
export async function callPublicApi(
  route: KnownRoute,
  method: "GET" | "POST",
  path: string,
  options: { body?: unknown; headers?: Record<string, string> } = {}
): Promise<PublicApiResponse> {
  const response = await fetch(`${publicApiBaseUrl()}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  recordRouteHit(route, response.status);
  const text = await response.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, headers: response.headers, text, json };
}
