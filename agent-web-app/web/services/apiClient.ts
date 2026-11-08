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

/** GETs `path` under the API base and parses the body through `schema`, so a drifted response fails here, not in a component. */
export async function getJson<T>(path: string, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  const response = await fetch(`${config.apiBaseUrl}${path}`);
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body ? String(body.error) : `HTTP ${response.status}`;
    throw new ApiError(response.status, message);
  }
  return schema.parse(body);
}
