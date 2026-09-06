import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { listRollups } from "../../service/analytics/analyticsRollupsService";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { ValidationError } from "../../models/errors";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/**
 * `GET /data/rollups` (`7-data-warehousing.md` §12) — the sample job's
 * pre-aggregated output from `AnalyticsRollups`, most recent first,
 * read-only.
 */
export const getRollupsController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("GetRollupsControllerInvoked", { event });

  const parsed = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsed.success) {
    logError("GetRollupsControllerValidationFailed", { issues: parsed.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  try {
    const response = await listRollups();
    logInfo("GetRollupsControllerCompleted", { count: response.rollups.length });
    return jsonResponse(200, response);
  } catch (err) {
    logError("GetRollupsControllerFailed", { error: err instanceof Error ? err.message : err });
    const statusCode = err instanceof ValidationError ? 400 : 500;
    return jsonResponse(statusCode, { message: "Failed to fetch rollups" });
  }
};
