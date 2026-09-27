import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { TerminalError, ValidationError } from "../../models/errors";
import { CreateFeatureFlagRequestSchema } from "../../models/featureFlag";
import { createFeatureFlag } from "../../service/featureFlag/featureFlagService";
import { requireAdminUser } from "./requireAdminUser";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/** `POST /admin/feature-flags` (`11-street-condition-implementation.md` §4.2) — admin-authorized. */
export const createFeatureFlagController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("CreateFeatureFlagControllerInvoked", { event });

  const parsedEvent = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    logError("CreateFeatureFlagControllerValidationFailed", { issues: parsedEvent.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  let rawBody: unknown = {};
  if (parsedEvent.data.body) {
    try {
      rawBody = JSON.parse(parsedEvent.data.body);
    } catch {
      logError("CreateFeatureFlagControllerBodyParseFailed", {});
      return jsonResponse(400, { message: "Malformed JSON body" });
    }
  }
  const parsedBody = CreateFeatureFlagRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    logError("CreateFeatureFlagControllerBodyValidationFailed", { issues: parsedBody.error.issues });
    return jsonResponse(400, { message: "Malformed request body", issues: parsedBody.error.issues });
  }

  const flagKey = parsedBody.data.flag_key;
  try {
    const user = await requireAdminUser(parsedEvent.data);
    const flag = await createFeatureFlag(parsedBody.data, user.user_id);
    const response = jsonResponse(201, flag);
    logInfo("CreateFeatureFlagControllerCompleted", { response });
    return response;
  } catch (err) {
    logError("CreateFeatureFlagControllerFailed", { flagKey, error: err instanceof Error ? err.message : err });
    if (err instanceof ValidationError) return jsonResponse(400, { message: err.message });
    if (err instanceof TerminalError) return jsonResponse(409, { message: `Feature flag ${flagKey} already exists` });
    return jsonResponse(500, { message: "Failed to create feature flag" });
  }
};
