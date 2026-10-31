import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { ulid } from "ulid";
import { logError, logInfo } from "../../../logger";
import { ApiGatewayHttpEventSchema } from "../../../models/apiGatewayHttpEvent";
import type {
  PublicApiCall,
  PublicApiOperation,
  PublicApiResult,
  PublicCallContext,
} from "../../../models/publicApi/publicApiCall";
import { UNKNOWN_REQUESTER } from "../../../models/publicApi/publicApiCall";
import { RequesterSchema } from "../../../models/publicApi/publicApiPrimitives";
import { publicError } from "./publicApiResponse";
import type { PublicV1ApiRouteKey } from "./publicV1ApiRoutes";

export type PublicV1Controller = (event: unknown, context: PublicCallContext) => Promise<PublicApiResult>;

/* Records each finished call; B8 adds the warehouse publish. */
export type PublicCallRecorder = (call: PublicApiCall) => Promise<void>;

export interface PublicV1RouterDeps {
  newCallId?: () => string;
  now?: () => number;
  recordCall?: PublicCallRecorder;
}

const OPERATIONS: Record<PublicV1ApiRouteKey, PublicApiOperation> = {
  "POST /v1/requests/search": "SEARCH_REQUESTS",
  "POST /v1/feature-requests": "CREATE_FEATURE_REQUEST",
  "GET /v1/feature-requests/{feature_request_id}": "GET_FEATURE_REQUEST",
  "GET /v1/openapi.yaml": "GET_OPENAPI_SPEC",
};

function isRouteKey(routeKey: string): routeKey is PublicV1ApiRouteKey {
  return Object.hasOwn(OPERATIONS, routeKey);
}

function outcomeOf(statusCode: number): PublicApiCall["outcome"] {
  if (statusCode >= 500) return "SERVER_ERROR";
  if (statusCode >= 400) return "CLIENT_ERROR";
  return "SUCCESS";
}

/* The call line is the usage row's source, so it's logged even when nothing else records it. */
const logCall: PublicCallRecorder = async (call) => {
  logInfo("PublicApiCall", { ...call });
};

/**
 * Builds the public API's Lambda handler (16-resident-action-models.md
 * §2.2): a call id for every call, `X-Requester` checked before dispatch,
 * every failure in the public error shape, `X-Call-Id` on every response,
 * and one usage record per call.
 */
export function createPublicV1Router(
  controllers: Partial<Record<PublicV1ApiRouteKey, PublicV1Controller>>,
  deps: PublicV1RouterDeps = {}
): (event: unknown) => Promise<APIGatewayProxyStructuredResultV2> {
  const now = deps.now ?? Date.now;
  const recordCall = deps.recordCall ?? logCall;

  return async (event) => {
    const startedAt = now();
    const callId = (deps.newCallId ?? ulid)();
    const routeKey = typeof (event as { routeKey?: unknown })?.routeKey === "string" ? (event as { routeKey: string }).routeKey : "UNKNOWN";
    const operation: PublicApiOperation = isRouteKey(routeKey) ? OPERATIONS[routeKey] : "UNKNOWN";
    const parsedEvent = ApiGatewayHttpEventSchema.safeParse(event);
    const rawRequester = parsedEvent.success ? parsedEvent.data.headers?.["x-requester"] : undefined;
    const requester = RequesterSchema.safeParse(rawRequester);
    logInfo("PublicV1RouterDispatch", { callId, routeKey, requester: rawRequester });

    let result: PublicApiResult;
    const controller = isRouteKey(routeKey) ? controllers[routeKey] : undefined;
    if (!parsedEvent.success) {
      logError("PublicV1RouterValidationFailed", { callId, issues: parsedEvent.error.issues });
      result = publicError(400, "VALIDATION_ERROR", "The request is malformed.");
    } else if (!requester.success) {
      result = publicError(400, "INVALID_REQUESTER", "The X-Requester header is missing or malformed.");
    } else if (!controller) {
      logError("PublicV1RouterUnknownRoute", { callId, routeKey });
      result = publicError(404, "NOT_FOUND", "No such route.");
    } else {
      try {
        result = await controller(event, { call_id: callId, requester: requester.data });
      } catch (err) {
        logError("PublicV1RouterControllerFailed", { callId, routeKey, error: err instanceof Error ? err.message : err });
        result = publicError(500, "INTERNAL_ERROR", "Something went wrong. Quote the X-Call-Id when reporting it.");
      }
    }

    const call: PublicApiCall = {
      call_id: callId,
      requester: requester.success ? requester.data : UNKNOWN_REQUESTER,
      operation,
      route_key: routeKey,
      status_code: result.status_code,
      outcome: outcomeOf(result.status_code),
      latency_ms: Math.max(0, Math.round(now() - startedAt)),
      request_params: result.usage.request_params,
      result_count: result.usage.result_count,
      resource_id: result.usage.resource_id,
      occurred_at: new Date(startedAt).toISOString(),
    };
    try {
      await recordCall(call);
    } catch (err) {
      logError("PublicV1RouterRecordCallFailed", { callId, error: err instanceof Error ? err.message : err });
    }

    const isText = typeof result.body === "string";
    const response: APIGatewayProxyStructuredResultV2 = {
      statusCode: result.status_code,
      headers: {
        "Content-Type": result.content_type ?? "application/json",
        "X-Call-Id": callId,
      },
      body: isText ? (result.body as string) : JSON.stringify(result.body),
    };
    logInfo("PublicV1RouterCompleted", { callId, routeKey, statusCode: response.statusCode });
    return response;
  };
}
