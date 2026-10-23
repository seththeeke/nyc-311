import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { jsonResponse } from "../jsonResponse";
import { ApiGatewayHttpEventSchema, type ApiGatewayHttpEvent } from "../../models/apiGatewayHttpEvent";
import { NotFoundError, ValidationError } from "../../models/errors";
import { getIdea, getResident, listIdeas, listResidents, parseLimit } from "../../service/read/residentReadService";

/* Short shared caching: ideas arrive a few times a day, and every page load makes several of these calls. */
const CACHE_HEADER = { "Cache-Control": "public, max-age=30" };

function pathParam(event: ApiGatewayHttpEvent, name: string): string {
  const value = event.pathParameters?.[name];
  if (!value) throw new ValidationError(`Missing path parameter ${name}`);
  return value;
}

async function route(event: ApiGatewayHttpEvent): Promise<unknown> {
  const query = event.queryStringParameters ?? {};
  const limit = parseLimit(query.limit);
  switch (event.routeKey) {
    case "GET /residents":
      return listResidents(limit, query.cursor);
    case "GET /residents/{personaId}":
      return getResident(pathParam(event, "personaId"));
    case "GET /residents/{personaId}/ideas":
      return listIdeas({ personaId: pathParam(event, "personaId"), limit, cursor: query.cursor });
    case "GET /residents/{personaId}/ideas/{ideaId}":
      return getIdea(pathParam(event, "personaId"), pathParam(event, "ideaId"));
    case "GET /ideas":
      return listIdeas({ limit, cursor: query.cursor });
    default:
      throw new NotFoundError(`No route ${event.routeKey ?? event.rawPath}`);
  }
}

/**
 * The public, read-only resident API (§4, Appendix K): residents and
 * their ideas, paginated. One Lambda serves every read route, chosen by
 * the matched `routeKey`. `400` for bad input, `404` for anything unknown.
 */
export const residentApiController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("ResidentApiControllerInvoked", { event });
  const parsed = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsed.success) {
    logError("ResidentApiControllerValidationFailed", { issues: parsed.error.issues });
    return jsonResponse(400, { message: "Malformed request" }, CACHE_HEADER);
  }
  try {
    const response = jsonResponse(200, await route(parsed.data), CACHE_HEADER);
    logInfo("ResidentApiControllerCompleted", { routeKey: parsed.data.routeKey, statusCode: response.statusCode });
    return response;
  } catch (err) {
    logError("ResidentApiControllerFailed", { routeKey: parsed.data.routeKey, error: err instanceof Error ? err.message : err });
    if (err instanceof ValidationError) return jsonResponse(400, { message: err.message }, CACHE_HEADER);
    if (err instanceof NotFoundError) return jsonResponse(404, { message: err.message }, CACHE_HEADER);
    return jsonResponse(500, { message: "Failed to read residents" }, CACHE_HEADER);
  }
};
