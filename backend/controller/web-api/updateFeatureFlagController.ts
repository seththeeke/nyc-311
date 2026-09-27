import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { NotFoundError, TerminalError, ValidationError } from "../../models/errors";
import { FlagKeyParamsSchema, UpdateFeatureFlagRequestSchema } from "../../models/featureFlag";
import { updateFeatureFlag } from "../../service/featureFlag/featureFlagService";
import { requireAdminUser } from "./requireAdminUser";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/**
 * `PUT /admin/feature-flags/{flag_key}` (`11-street-condition-implementation.md`
 * §4.2) — admin-authorized. Replaces the whole config; a stale
 * `expected_version` is a `409` so a stale tab can't erase newer edits.
 */
export const updateFeatureFlagController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("UpdateFeatureFlagControllerInvoked", { event });

  const parsedEvent = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    logError("UpdateFeatureFlagControllerValidationFailed", { issues: parsedEvent.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  const parsedParams = FlagKeyParamsSchema.safeParse(parsedEvent.data.pathParameters ?? {});
  if (!parsedParams.success) {
    logError("UpdateFeatureFlagControllerParamsValidationFailed", { issues: parsedParams.error.issues });
    return jsonResponse(400, { message: "Missing or malformed flag_key path parameter" });
  }

  let rawBody: unknown = {};
  if (parsedEvent.data.body) {
    try {
      rawBody = JSON.parse(parsedEvent.data.body);
    } catch {
      logError("UpdateFeatureFlagControllerBodyParseFailed", {});
      return jsonResponse(400, { message: "Malformed JSON body" });
    }
  }
  const parsedBody = UpdateFeatureFlagRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    logError("UpdateFeatureFlagControllerBodyValidationFailed", { issues: parsedBody.error.issues });
    return jsonResponse(400, { message: "Malformed request body", issues: parsedBody.error.issues });
  }

  const { flag_key: flagKey } = parsedParams.data;
  try {
    const user = await requireAdminUser(parsedEvent.data);
    const flag = await updateFeatureFlag(flagKey, parsedBody.data, user.user_id);
    const response = jsonResponse(200, flag);
    logInfo("UpdateFeatureFlagControllerCompleted", { response });
    return response;
  } catch (err) {
    logError("UpdateFeatureFlagControllerFailed", { flagKey, error: err instanceof Error ? err.message : err });
    if (err instanceof NotFoundError) return jsonResponse(404, { message: err.message });
    if (err instanceof ValidationError) return jsonResponse(400, { message: err.message });
    if (err instanceof TerminalError) {
      return jsonResponse(409, { message: `Feature flag ${flagKey} changed since version ${parsedBody.data.expected_version} — reload and retry` });
    }
    return jsonResponse(500, { message: "Failed to update feature flag" });
  }
};
