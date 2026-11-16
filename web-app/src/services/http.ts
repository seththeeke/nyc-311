import { fetchAuthSession } from "aws-amplify/auth";
import { config } from "../config";
import { ApiErrorBodySchema } from "../models/apiErrorBody";

/*
 * The one place a live service attaches the admin JWT to a request, and the
 * one place it reads an API error body. Every admin service calls these
 * instead of keeping its own copy (#204).
 */

/** Fetches `config.apiBaseUrl + path` with the signed-in admin's id token; throws "Not authenticated" without one. */
export async function authorizedFetch(path: string, init?: RequestInit): Promise<Response> {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();
  if (!idToken) {
    throw new Error("Not authenticated");
  }
  return fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${idToken}` },
  });
}

/** The API's own `message` from a failed response's JSON body, or undefined when the body is missing or not that shape. */
export async function readApiErrorMessage(response: Response): Promise<string | undefined> {
  const body: unknown = await response.json().catch(() => null);
  const parsed = ApiErrorBodySchema.safeParse(body);
  return parsed.success ? parsed.data.message : undefined;
}
