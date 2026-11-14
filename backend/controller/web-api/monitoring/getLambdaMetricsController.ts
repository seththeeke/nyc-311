import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../../logger";
import { getLambdaHealth } from "../../../service/monitoring/lambdaMetricsService";
import { ApiGatewayHttpEventSchema } from "../../../models/apiGatewayHttpEvent";
import { jsonResponse } from "../shared/jsonResponse";
import { errorResponse } from "../shared/errorResponse";

/**
 * `GET /lambda-metrics` entry point — the Lambda health tile added after
 * the 2026-08-22 fan-out-Lambda incident. Validates the HTTP API v2 event,
 * delegates to `getLambdaHealth`, and maps any failure to an HTTP status
 * code — same shape as `getPollerMetricsController`.
 */
export const getLambdaMetricsController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("GetLambdaMetricsControllerInvoked", { event });

  const parsed = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsed.success) {
    logError("GetLambdaMetricsControllerValidationFailed", { issues: parsed.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  try {
    const lambdas = await getLambdaHealth();
    logInfo("GetLambdaMetricsControllerCompleted", { count: lambdas.length });
    return jsonResponse(200, { lambdas });
  } catch (err) {
    logError("GetLambdaMetricsControllerFailed", { error: err instanceof Error ? err.message : err });
    return errorResponse(err, "Failed to fetch Lambda metrics");
  }
};
