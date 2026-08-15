import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { RequestDao } from "../../dao/request/requestDao";
import { listPollerMetrics } from "../../service/metrics/pollerMetricsService";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { ValidationError } from "../../models/errors";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Constructed once at module scope (Lambda cold start) and reused across
// warm invocations, rather than rebuilt per call — per CLAUDE.md §5.2.
const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const requestDao = new RequestDao(ddbClient, requireEnv("REQUESTS_TABLE_NAME"));

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/**
 * Entry point for `GET /ingestion/metrics` — the first public API Gateway
 * route in the project (1-data-ingestion.md §8a). Validates the HTTP API v2
 * proxy event first (CLAUDE.md §5.2's "every controller parses its raw
 * trigger payload through a zod schema" rule, even though no field here
 * drives branching yet), delegates to `listPollerMetrics`, and — unlike the
 * Step-Functions-invoked poller controller, which lets errors propagate —
 * maps any failure to an HTTP status code, since API Gateway is this
 * controller's caller.
 */
export const getPollerMetricsController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("GetPollerMetricsControllerInvoked", { event });

  const parsed = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsed.success) {
    logError("GetPollerMetricsControllerValidationFailed", { issues: parsed.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  try {
    const metrics = await listPollerMetrics({ requestDao });
    logInfo("GetPollerMetricsControllerCompleted", { count: metrics.length });
    return jsonResponse(200, { metrics });
  } catch (err) {
    logError("GetPollerMetricsControllerFailed", { error: err instanceof Error ? err.message : err });
    const statusCode = err instanceof ValidationError ? 400 : 500;
    return jsonResponse(statusCode, { message: "Failed to fetch ingestion metrics" });
  }
};
