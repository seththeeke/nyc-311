import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { ValidationError } from "../../models/errors";
import { requireAdminUser } from "./requireAdminUser";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/**
 * `GET /admin/whoami` (`9-admin-auth-integration.md` §8) — the one
 * authenticated route exercised by the pipeline's automatic integration
 * gate, purely to prove the JWT authorizer + `Users` table wiring works
 * end-to-end. Not otherwise used by the frontend today.
 */
export const whoamiController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("WhoamiControllerInvoked", { event });

  const parsedEvent = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    logError("WhoamiControllerValidationFailed", { issues: parsedEvent.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  try {
    const user = await requireAdminUser(parsedEvent.data);
    logInfo("WhoamiControllerCompleted", { userId: user.user_id });
    return jsonResponse(200, user);
  } catch (err) {
    logError("WhoamiControllerFailed", { error: err instanceof Error ? err.message : err });
    const statusCode = err instanceof ValidationError ? 400 : 500;
    return jsonResponse(statusCode, { message: "Failed to resolve current user" });
  }
};
