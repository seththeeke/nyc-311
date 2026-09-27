import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { NotFoundError } from "../../models/errors";
import { FlagKeyParamsSchema } from "../../models/featureFlag";
import { deleteFeatureFlag } from "../../service/featureFlag/featureFlagService";
import { requireAdminUser } from "./requireAdminUser";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/** `DELETE /admin/feature-flags/{flag_key}` (`11-street-condition-implementation.md` §4.2) — admin-authorized, unconditional. */
export const deleteFeatureFlagController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("DeleteFeatureFlagControllerInvoked", { event });

  const parsedEvent = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    logError("DeleteFeatureFlagControllerValidationFailed", { issues: parsedEvent.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  const parsedParams = FlagKeyParamsSchema.safeParse(parsedEvent.data.pathParameters ?? {});
  if (!parsedParams.success) {
    logError("DeleteFeatureFlagControllerParamsValidationFailed", { issues: parsedParams.error.issues });
    return jsonResponse(400, { message: "Missing or malformed flag_key path parameter" });
  }

  const { flag_key: flagKey } = parsedParams.data;
  try {
    const user = await requireAdminUser(parsedEvent.data);
    await deleteFeatureFlag(flagKey, user.user_id);
    const response: APIGatewayProxyStructuredResultV2 = { statusCode: 204 };
    logInfo("DeleteFeatureFlagControllerCompleted", { response });
    return response;
  } catch (err) {
    logError("DeleteFeatureFlagControllerFailed", { flagKey, error: err instanceof Error ? err.message : err });
    if (err instanceof NotFoundError) return jsonResponse(404, { message: err.message });
    return jsonResponse(500, { message: "Failed to delete feature flag" });
  }
};
