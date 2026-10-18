import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { listWarehouseJobRuns } from "../../service/analytics/warehouseJobRunsService";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { ValidationError } from "../../models/errors";
import { jsonResponse } from "./jsonResponse";

/**
 * `GET /data/jobs` (`7-data-warehousing.md` §12) — most-recent-first
 * warehouse job run history, read-only.
 */
export const getWarehouseJobRunsController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("GetWarehouseJobRunsControllerInvoked", { event });

  const parsed = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsed.success) {
    logError("GetWarehouseJobRunsControllerValidationFailed", { issues: parsed.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  try {
    const response = await listWarehouseJobRuns();
    logInfo("GetWarehouseJobRunsControllerCompleted", { count: response.jobRuns.length });
    return jsonResponse(200, response);
  } catch (err) {
    logError("GetWarehouseJobRunsControllerFailed", { error: err instanceof Error ? err.message : err });
    const statusCode = err instanceof ValidationError ? 400 : 500;
    return jsonResponse(statusCode, { message: "Failed to fetch warehouse job runs" });
  }
};
