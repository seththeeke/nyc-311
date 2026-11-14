import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../../logger";
import { ApiGatewayHttpEventSchema } from "../../../models/apiGatewayHttpEvent";
import { FlagKeyParamsSchema } from "../../../models/featureFlag";
import { getFeatureFlag } from "../../../service/featureFlag/featureFlagService";
import { jsonResponse } from "../shared/jsonResponse";
import { errorResponse } from "../shared/errorResponse";

/** `GET /feature-flags/{flag_key}` (`11-street-condition-implementation.md` §4.2) — public. */
export const getFeatureFlagController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("GetFeatureFlagControllerInvoked", { event });

  const parsedEvent = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    logError("GetFeatureFlagControllerValidationFailed", { issues: parsedEvent.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  const parsedParams = FlagKeyParamsSchema.safeParse(parsedEvent.data.pathParameters ?? {});
  if (!parsedParams.success) {
    logError("GetFeatureFlagControllerParamsValidationFailed", { issues: parsedParams.error.issues });
    return jsonResponse(400, { message: "Missing or malformed flag_key path parameter" });
  }

  const { flag_key: flagKey } = parsedParams.data;
  try {
    const flag = await getFeatureFlag(flagKey);
    const response = jsonResponse(200, flag);
    logInfo("GetFeatureFlagControllerCompleted", { response });
    return response;
  } catch (err) {
    logError("GetFeatureFlagControllerFailed", { flagKey, error: err instanceof Error ? err.message : err });
    return errorResponse(err, "Failed to fetch feature flag");
  }
};
