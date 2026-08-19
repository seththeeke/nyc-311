import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { listPollerMetrics } from "../../service/ingestion/nyc311RequestService";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { ValidationError } from "../../models/errors";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/**
 * `GET /ingestion/metrics` entry point (1-data-ingestion.md §8a). Validates
 * the HTTP API v2 event, delegates to `listPollerMetrics`, and — since API
 * Gateway is the caller here, unlike the Step-Functions poller controller —
 * maps any failure to an HTTP status code instead of letting it propagate.
 */
export const getPollerMetricsController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("GetPollerMetricsControllerInvoked", { event });

  const parsed = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsed.success) {
    logError("GetPollerMetricsControllerValidationFailed", { issues: parsed.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  try {
    const metrics = await listPollerMetrics();
    logInfo("GetPollerMetricsControllerCompleted", { count: metrics.length });
    return jsonResponse(200, { metrics });
  } catch (err) {
    logError("GetPollerMetricsControllerFailed", { error: err instanceof Error ? err.message : err });
    const statusCode = err instanceof ValidationError ? 400 : 500;
    return jsonResponse(statusCode, { message: "Failed to fetch ingestion metrics" });
  }
};
