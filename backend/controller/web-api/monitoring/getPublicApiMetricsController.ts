import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../../logger";
import { ApiGatewayHttpEventSchema } from "../../../models/apiGatewayHttpEvent";
import { getPublicApiMetrics } from "../../../service/monitoring/publicApiMetricsService";
import { jsonResponse } from "../shared/jsonResponse";

/** `GET /public-api/metrics` — the Public API page's Health section (16-resident-action-models.md §6.2). Internal, not a /v1/ route. */
export const getPublicApiMetricsController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("GetPublicApiMetricsControllerInvoked", { event });

  const parsed = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsed.success) {
    logError("GetPublicApiMetricsControllerValidationFailed", { issues: parsed.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  try {
    const metrics = await getPublicApiMetrics();
    logInfo("GetPublicApiMetricsControllerCompleted", { totals: metrics.totals });
    return jsonResponse(200, metrics);
  } catch (err) {
    logError("GetPublicApiMetricsControllerFailed", { error: err instanceof Error ? err.message : err });
    return jsonResponse(500, { message: "Failed to fetch public API metrics" });
  }
};
