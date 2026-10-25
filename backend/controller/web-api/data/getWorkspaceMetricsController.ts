import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../../logger";
import { getLiveWorkspaceMetrics } from "../../../service/analytics/liveWorkspaceMetricsService";
import { ApiGatewayHttpEventSchema } from "../../../models/apiGatewayHttpEvent";
import { jsonResponse } from "../shared/jsonResponse";

/**
 * `GET /workspace/metrics` — the secondary workspace's metric tiles: this
 * New York week to date from the live day buckets, against the same days
 * of the week before.
 */
export const getWorkspaceMetricsController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("GetWorkspaceMetricsControllerInvoked", { event });

  const parsed = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsed.success) {
    logError("GetWorkspaceMetricsControllerValidationFailed", { issues: parsed.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  try {
    const metrics = await getLiveWorkspaceMetrics();
    const response = jsonResponse(200, metrics);
    logInfo("GetWorkspaceMetricsControllerCompleted", { response });
    return response;
  } catch (err) {
    logError("GetWorkspaceMetricsControllerFailed", { error: err instanceof Error ? err.message : err });
    return jsonResponse(500, { message: "Failed to fetch workspace metrics" });
  }
};
