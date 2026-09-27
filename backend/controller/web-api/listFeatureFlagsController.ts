import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { listFeatureFlags } from "../../service/featureFlag/featureFlagService";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/** `GET /feature-flags` (`11-street-condition-implementation.md` §4.2) — public. */
export const listFeatureFlagsController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("ListFeatureFlagsControllerInvoked", { event });

  const parsedEvent = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    logError("ListFeatureFlagsControllerValidationFailed", { issues: parsedEvent.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  try {
    const flags = await listFeatureFlags();
    const response = jsonResponse(200, { flags });
    logInfo("ListFeatureFlagsControllerCompleted", { response });
    return response;
  } catch (err) {
    logError("ListFeatureFlagsControllerFailed", { error: err instanceof Error ? err.message : err });
    return jsonResponse(500, { message: "Failed to list feature flags" });
  }
};
