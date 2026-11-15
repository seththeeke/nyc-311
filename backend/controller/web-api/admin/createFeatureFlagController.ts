import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../../logger";
import { ApiGatewayHttpEventSchema } from "../../../models/apiGatewayHttpEvent";
import { TerminalError } from "../../../models/errors";
import { CreateFeatureFlagRequestSchema } from "../../../models/featureFlag";
import { createFeatureFlag } from "../../../service/featureFlag/featureFlagService";
import { isAgentCaller } from "./isAgentCaller";
import { requireAdminUser } from "./requireAdminUser";
import { jsonResponse } from "../shared/jsonResponse";
import { errorResponse } from "../shared/errorResponse";

/**
 * `POST /admin/feature-flags` (`11-street-condition-implementation.md`
 * §4.2) — the admin, or the Software Engineer agent
 * (docs/17-executive-team.md §22.9), recorded by its email.
 */
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
    const createdBy = isAgentCaller(parsedEvent.data)
      ? (parsedEvent.data.requestContext.authorizer?.jwt.claims.email ?? "unknown")
      : (await requireAdminUser(parsedEvent.data)).user_id;
    const flag = await createFeatureFlag(parsedBody.data, createdBy);
    const response = jsonResponse(201, flag);
    logInfo("CreateFeatureFlagControllerCompleted", { response });
    return response;
  } catch (err) {
    logError("CreateFeatureFlagControllerFailed", { flagKey, error: err instanceof Error ? err.message : err });
    /* The DAO's conditional create surfaces a duplicate key as TerminalError. */
    return errorResponse(err, "Failed to create feature flag", [{ type: TerminalError, status: 409, message: `Feature flag ${flagKey} already exists` }]);
  }
};
