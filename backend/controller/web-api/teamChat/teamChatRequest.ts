import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ZodType, ZodTypeDef } from "zod";
import { logError, logInfo } from "../../../logger";
import { ApiGatewayHttpEventSchema, type ApiGatewayHttpEvent } from "../../../models/apiGatewayHttpEvent";
import { ConflictError, ForbiddenError, NotFoundError, RateLimitedError, ValidationError } from "../../../models/errors";
import type { TeamChatMember } from "../../../models/teamChatMember";
import { resolveCaller, type TeamChatPageQuery } from "../../../service/teamChat/teamChatService";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
/* Read routes are polled every 5 s; a short cache absorbs a crowd (§10.4). */
export const READ_CACHE_HEADERS = { "Content-Type": "application/json", "Cache-Control": "public, max-age=5" };

export interface TeamChatResult {
  status: number;
  body?: unknown;
  /* Only reads are cacheable. */
  cacheable?: boolean;
}

const ERROR_STATUS: readonly [new (...args: never[]) => Error, number][] = [
  [ValidationError, 400],
  [ForbiddenError, 403],
  [NotFoundError, 404],
  [ConflictError, 409],
  [RateLimitedError, 429],
];

/**
 * Runs one Team Chat controller: logs the request, parses the event, maps
 * the typed errors to statuses (CLAUDE.md §5.2) and logs the response.
 */
export async function handleTeamChat(name: string, event: unknown, run: (event: ApiGatewayHttpEvent) => Promise<TeamChatResult>): Promise<APIGatewayProxyStructuredResultV2> {
  logInfo(`${name}Invoked`, { event });
  const parsed = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsed.success) {
    logError(`${name}ValidationFailed`, { issues: parsed.error.issues });
    return { statusCode: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Malformed request" }) };
  }
  let result: TeamChatResult;
  try {
    result = await run(parsed.data);
  } catch (err) {
    const status = ERROR_STATUS.find(([type]) => err instanceof type)?.[1];
    const message = err instanceof Error ? err.message : String(err);
    if (!status) {
      logError(`${name}Failed`, { error: message });
      return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Internal server error" }) };
    }
    result = { status, body: { message } };
  }
  const response = {
    statusCode: result.status,
    headers: result.cacheable ? READ_CACHE_HEADERS : { "Content-Type": "application/json" },
    ...(result.body === undefined ? {} : { body: JSON.stringify(result.body) }),
  };
  logInfo(`${name}Completed`, { response });
  return response;
}

/** A path parameter, URL-decoded. */
export function pathParam(event: ApiGatewayHttpEvent, name: string): string {
  const raw = event.pathParameters?.[name];
  if (!raw) throw new ValidationError(`Missing path parameter ${name}`);
  try {
    return decodeURIComponent(raw);
  } catch {
    throw new ValidationError(`Malformed path parameter ${name}`);
  }
}

/** `?thread_id=`, which names a reply's root for an edit, delete or reaction. */
export function threadIdOf(event: ApiGatewayHttpEvent): string | null {
  return event.queryStringParameters?.thread_id ?? null;
}

/** `?before=`, `?after=` and `?limit=` (1 to 100, default 50). */
export function pageQueryOf(event: ApiGatewayHttpEvent): TeamChatPageQuery {
  const query = event.queryStringParameters ?? {};
  const limit = query.limit === undefined ? DEFAULT_LIMIT : Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw new ValidationError(`limit must be an integer from 1 to ${MAX_LIMIT}`);
  if (query.before && query.after) throw new ValidationError("Pass before or after, not both");
  return { limit, ...(query.before ? { before: query.before } : {}), ...(query.after ? { after: query.after } : {}) };
}

/** The JSON body, parsed through `schema`. */
export function bodyOf<T>(event: ApiGatewayHttpEvent, schema: ZodType<T, ZodTypeDef, unknown>): T {
  let raw: unknown;
  try {
    raw = JSON.parse(event.body ?? "");
  } catch {
    throw new ValidationError("Body must be JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Invalid body", parsed.error.issues);
  return parsed.data;
}

/** The member the ID token's email resolves to (§10.5). */
export async function callerOf(event: ApiGatewayHttpEvent): Promise<TeamChatMember> {
  const email = event.requestContext.authorizer?.jwt.claims.email;
  if (!email) throw new ForbiddenError("No email claim on the token");
  return resolveCaller(email);
}
