import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { listReports } from "../../service/analytics/reportsService";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { ValidationError } from "../../models/errors";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/**
 * `GET /reports` (`7-data-warehousing.md` §12) — the business-facing
 * reporting surface. Assembles a week-over-week trend per registered
 * report from the materialized job resultsets in S3. Read-only.
 */
export const getReportsController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("GetReportsControllerInvoked", { event });

  const parsed = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsed.success) {
    logError("GetReportsControllerValidationFailed", { issues: parsed.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  try {
    const response = await listReports();
    logInfo("GetReportsControllerCompleted", { count: response.reports.length });
    return jsonResponse(200, response);
  } catch (err) {
    logError("GetReportsControllerFailed", { error: err instanceof Error ? err.message : err });
    const statusCode = err instanceof ValidationError ? 400 : 500;
    return jsonResponse(statusCode, { message: "Failed to fetch reports" });
  }
};
