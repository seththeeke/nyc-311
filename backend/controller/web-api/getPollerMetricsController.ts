import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { getCursorStatus, listPollerMetrics } from "../../service/ingestion/nyc311RequestService";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { ValidationError } from "../../models/errors";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/**
 * `GET /ingestion/metrics` entry point (1-data-ingestion.md §8a, cursor
 * section added per the 2026-08-22 fan-out-Lambda incident). Validates the
 * HTTP API v2 event, delegates to `listPollerMetrics`/`getCursorStatus`,
 * and — since API Gateway is the caller here, unlike the Step-Functions
 * poller controller — maps any failure to an HTTP status code instead of
 * letting it propagate.
 */
export const getPollerMetricsController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("GetPollerMetricsControllerInvoked", { event });

  const parsed = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsed.success) {
    logError("GetPollerMetricsControllerValidationFailed", { issues: parsed.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  try {
    const [metrics, cursor] = await Promise.all([listPollerMetrics(), getCursorStatus()]);
    logInfo("GetPollerMetricsControllerCompleted", { count: metrics.length, cursor });
    return jsonResponse(200, { metrics, cursor });
  } catch (err) {
    logError("GetPollerMetricsControllerFailed", { error: err instanceof Error ? err.message : err });
    const statusCode = err instanceof ValidationError ? 400 : 500;
    return jsonResponse(statusCode, { message: "Failed to fetch ingestion metrics" });
  }
};
