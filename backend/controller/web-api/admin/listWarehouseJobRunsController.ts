import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../../logger";
import { listWarehouseJobRuns } from "../../../service/analytics/warehouseJobRunsService";
import { ApiGatewayHttpEventSchema } from "../../../models/apiGatewayHttpEvent";
import { ValidationError } from "../../../models/errors";
import { requireAdminUser } from "./requireAdminUser";
import { jsonResponse } from "../shared/jsonResponse";

/**
 * `GET /admin/warehouse/job-runs` — most-recent-first warehouse job run
 * history, read-only. Replaces the public `GET /data/jobs`, whose only
 * caller was the admin warehouse page (`15-resource-consolidation.md` §3.3).
 */
export const listWarehouseJobRunsController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("ListWarehouseJobRunsControllerInvoked", { event });

  const parsedEvent = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    logError("ListWarehouseJobRunsControllerValidationFailed", { issues: parsedEvent.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  try {
    await requireAdminUser(parsedEvent.data);
    const response = await listWarehouseJobRuns();
    logInfo("ListWarehouseJobRunsControllerCompleted", { count: response.jobRuns.length });
    return jsonResponse(200, response);
  } catch (err) {
    logError("ListWarehouseJobRunsControllerFailed", { error: err instanceof Error ? err.message : err });
    const statusCode = err instanceof ValidationError ? 400 : 500;
    return jsonResponse(statusCode, { message: "Failed to fetch warehouse job runs" });
  }
};
