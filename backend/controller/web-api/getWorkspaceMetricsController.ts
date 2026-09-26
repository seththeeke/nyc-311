import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { getWorkspaceMetrics } from "../../service/analytics/workspaceMetricsService";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/**
 * `GET /workspace/metrics` — the secondary workspace's metric tiles,
 * computed from the latest `wbr` warehouse job run. Always `200` once
 * validated; a job that hasn't run yet comes back as all-null values.
 */
export const getWorkspaceMetricsController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("GetWorkspaceMetricsControllerInvoked", { event });

  const parsed = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsed.success) {
    logError("GetWorkspaceMetricsControllerValidationFailed", { issues: parsed.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  try {
    const metrics = await getWorkspaceMetrics();
    const response = jsonResponse(200, metrics);
    logInfo("GetWorkspaceMetricsControllerCompleted", { response });
    return response;
  } catch (err) {
    logError("GetWorkspaceMetricsControllerFailed", { error: err instanceof Error ? err.message : err });
    return jsonResponse(500, { message: "Failed to fetch workspace metrics" });
  }
};
