import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { listWarehouseJobs } from "../../service/analytics/warehouseJobDefinitionService";
import { requireAdminUser } from "./requireAdminUser";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/**
 * `GET /admin/warehouse/jobs` (`7-data-warehousing.md` §12b, Leg 8) —
 * admin-authorized (unlike the public run-history `GET /data/jobs` — a
 * job's SQL/cadence isn't public the way its run history is).
 * Most-recently-created first.
 */
export const listWarehouseJobsController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("ListWarehouseJobsControllerInvoked", { event });

  const parsedEvent = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    logError("ListWarehouseJobsControllerValidationFailed", { issues: parsedEvent.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  try {
    await requireAdminUser(parsedEvent.data);
    const jobs = await listWarehouseJobs();
    logInfo("ListWarehouseJobsControllerCompleted", { count: jobs.length });
    return jsonResponse(200, { jobs });
  } catch (err) {
    logError("ListWarehouseJobsControllerFailed", { error: err instanceof Error ? err.message : err });
    return jsonResponse(500, { message: "Failed to list jobs" });
  }
};
