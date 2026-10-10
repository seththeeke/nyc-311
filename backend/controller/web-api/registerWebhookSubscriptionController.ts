import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { ApiGatewayHttpEventSchema, type ApiGatewayHttpEvent } from "../../models/apiGatewayHttpEvent";
import { ConflictError, TerminalError, UnauthorizedError, ValidationError } from "../../models/errors";
import { RegisterWebhookSubscriptionRequestSchema } from "../../models/webhookSubscription";
import { registerWebhookSubscription } from "../../service/webhook/webhookSubscriptionService";

const JSON_HEADERS = { "Content-Type": "application/json" };
const API_KEY_HEADER = "x-api-key";
const REDACTED = "[REDACTED]";

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/*
 * The one exception to "log the full request" (CLAUDE.md §5.2): this
 * request carries two credentials, the registration key header and the
 * subscriber's signing secret in the body. Both are replaced before
 * logging; everything else is logged as usual.
 */
function redactedForLog(event: ApiGatewayHttpEvent, body: unknown): Record<string, unknown> {
  const headers = { ...event.headers };
  if (API_KEY_HEADER in headers) headers[API_KEY_HEADER] = REDACTED;
  const safeBody = typeof body === "object" && body !== null && "secret" in body ? { ...body, secret: REDACTED } : body;
  return { ...event, headers, body: safeBody };
}

/**
 * `POST /webhook-subscriptions` (`13-customer-simulation.md` §5) —
 * authenticated by the registration key in `x-api-key`, checked in the
 * service. `201` for a new subscription, `200` when the callback URL was
 * already registered and its row was updated.
 */
export const registerWebhookSubscriptionController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  const parsedEvent = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    /* Not the raw event — a request too malformed to parse can't be redacted reliably. */
    logError("RegisterWebhookSubscriptionControllerValidationFailed", { issues: parsedEvent.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  let rawBody: unknown = {};
  if (parsedEvent.data.body) {
    try {
      rawBody = JSON.parse(parsedEvent.data.body);
    } catch {
      logError("RegisterWebhookSubscriptionControllerBodyParseFailed", {});
      return jsonResponse(400, { message: "Malformed JSON body" });
    }
  }
  logInfo("RegisterWebhookSubscriptionControllerInvoked", { event: redactedForLog(parsedEvent.data, rawBody) });

  const parsedBody = RegisterWebhookSubscriptionRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    /* Issue paths and messages only — zod issues never echo the offending value. */
    logError("RegisterWebhookSubscriptionControllerBodyValidationFailed", { issues: parsedBody.error.issues });
    return jsonResponse(400, { message: "Malformed request body", issues: parsedBody.error.issues });
  }

  try {
    const result = await registerWebhookSubscription(parsedBody.data, parsedEvent.data.headers?.[API_KEY_HEADER]);
    const response = jsonResponse(result.created ? 201 : 200, result.subscription);
    logInfo("RegisterWebhookSubscriptionControllerCompleted", { response });
    return response;
  } catch (err) {
    logError("RegisterWebhookSubscriptionControllerFailed", { error: err instanceof Error ? err.message : err });
    if (err instanceof UnauthorizedError) return jsonResponse(401, { message: err.message });
    if (err instanceof ValidationError) return jsonResponse(400, { message: err.message });
    if (err instanceof ConflictError || err instanceof TerminalError) return jsonResponse(409, { message: err.message });
    return jsonResponse(500, { message: "Failed to register webhook subscription" });
  }
};
