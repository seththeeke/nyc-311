import type { ZodType, ZodTypeDef } from "zod";
import { config } from "../config.ts";

/** A non-2xx API response, with the server's `{ error }` message when it sent one. */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** The header every write carries (SPEC.md §5.1); the server refuses a write without it. */
export const WRITE_HEADERS = { "Content-Type": "application/json", "X-Agent-Orchestrator": "1" };

/** GETs `path` under the API base and parses the body through `schema`, so a drifted response fails here, not in a component. */
export async function getJson<T>(path: string, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  return parseResponse(await fetch(`${config.apiBaseUrl}${path}`), schema);
}

/** POSTs `body` as JSON with the write header, and parses the response like getJson. */
export async function postJson<T>(path: string, body: unknown, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  return parseResponse(await fetch(`${config.apiBaseUrl}${path}`, { method: "POST", headers: WRITE_HEADERS, body: JSON.stringify(body) }), schema);
}

async function parseResponse<T>(response: Response, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body ? String(body.error) : `HTTP ${response.status}`;
    throw new ApiError(response.status, message);
  }
  return schema.parse(body);
}
