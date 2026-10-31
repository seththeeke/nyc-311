import { requireEnv } from "../../env";
import { logInfo } from "../../logger";

/* Each call gets this long before it counts as failed; a tool's failure goes back to the model, not to a retry. */
const CALL_TIMEOUT_MS = 10_000;

export interface PublicApiRequest {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  /* `X-Requester` and anything else the recipe sets. */
  headers: Record<string, string>;
}

export interface PublicApiReply {
  status_code: number;
  /* BoroughSim's X-Call-Id, linking this call to its public_api_calls row. */
  call_id: string | null;
  /* Parsed JSON, or the raw text when the body isn't JSON. */
  body: unknown;
}

export interface PublicApiClientDeps {
  fetchFn?: typeof fetch;
  baseUrl?: string;
}

/**
 * One HTTPS call to BoroughSim's public API at its public URL, the only
 * way the customer reaches BoroughSim (docs/16 §1). Network failures and
 * timeouts throw; HTTP errors come back as replies.
 */
export async function callPublicApi(request: PublicApiRequest, deps: PublicApiClientDeps = {}): Promise<PublicApiReply> {
  const baseUrl = deps.baseUrl ?? requireEnv("PUBLIC_API_BASE_URL");
  const fetchFn = deps.fetchFn ?? fetch;
  logInfo("PublicApiCallStarted", { method: request.method, path: request.path, body: request.body });
  const response = await fetchFn(`${baseUrl}${request.path}`, {
    method: request.method,
    headers: { "Content-Type": "application/json", ...request.headers },
    ...(request.body !== undefined ? { body: JSON.stringify(request.body) } : {}),
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  const reply: PublicApiReply = { status_code: response.status, call_id: response.headers.get("x-call-id"), body };
  logInfo("PublicApiCallCompleted", { method: request.method, path: request.path, statusCode: reply.status_code, callId: reply.call_id });
  return reply;
}
