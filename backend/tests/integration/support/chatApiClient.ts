import { lookupStackOutput } from "./cfnOutputs";
import { recordRouteHit, type KnownRoute } from "./routeTracker";

/*
 * The Team Chat API (docs/17-executive-team.md §10) has its own host and
 * stack: CHAT_API_BASE_URL in the pipeline, else Nyc311TeamChat-<env>'s
 * TeamChatApiUrl output.
 */
const STACK_NAME_BY_TARGET: Record<string, string> = { test: "Nyc311TeamChat-Test", prod: "Nyc311TeamChat-Prod" };

let cachedBaseUrl: string | undefined;

function chatApiBaseUrl(): string {
  if (cachedBaseUrl) return cachedBaseUrl;
  const target = process.env.INTEGRATION_TARGET ?? "";
  const stackName = STACK_NAME_BY_TARGET[target];
  if (!process.env.CHAT_API_BASE_URL && !stackName) throw new Error(`The chat API has no local target — INTEGRATION_TARGET is ${JSON.stringify(target)}`);
  cachedBaseUrl = (process.env.CHAT_API_BASE_URL ?? lookupStackOutput(stackName, "TeamChatApiUrl")).replace(/\/$/, "");
  return cachedBaseUrl;
}

export interface ChatApiResponse {
  status: number;
  headers: Headers;
  /* The parsed body, or null for an empty one (204). */
  json: unknown;
}

export interface ChatApiOptions {
  body?: unknown;
  idToken?: string;
  /* False for a deliberate failure, so the route report records only the happy path. */
  track?: boolean;
}

/** One call to the chat API, tracked in the route report by route key. */
export async function callChatApi(route: KnownRoute, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string, options: ChatApiOptions = {}): Promise<ChatApiResponse> {
  const response = await fetch(`${chatApiBaseUrl()}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(options.idToken ? { Authorization: `Bearer ${options.idToken}` } : {}) },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  if (options.track !== false) recordRouteHit(route, response.status);
  const text = await response.text();
  return { status: response.status, headers: response.headers, json: text ? JSON.parse(text) : null };
}
