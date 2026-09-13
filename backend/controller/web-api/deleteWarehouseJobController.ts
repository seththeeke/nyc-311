import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { DeleteWarehouseJobParamsSchema } from "../../models/warehouseJobRequest";
import { NotFoundError, ValidationError } from "../../models/errors";
import { deleteWarehouseJob } from "../../service/analytics/warehouseJobDefinitionService";
import { requireAdminUser } from "./requireAdminUser";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/**
 * `DELETE /admin/warehouse/jobs/{name}` (`7-data-warehousing.md` §12b,
 * Leg 8) — admin-authorized. Stops the job's schedule and removes its
 * S3 SQL file + DDB definition; every past `WarehouseJobRuns` row and
 * `job-results/` resultset is left untouched (§8).
 */
export const deleteWarehouseJobController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("DeleteWarehouseJobControllerInvoked", { event });

  const parsedEvent = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    logError("DeleteWarehouseJobControllerValidationFailed", { issues: parsedEvent.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  const parsedParams = DeleteWarehouseJobParamsSchema.safeParse(parsedEvent.data.pathParameters ?? {});
  if (!parsedParams.success) {
    logError("DeleteWarehouseJobControllerParamsValidationFailed", { issues: parsedParams.error.issues });
    return jsonResponse(400, { message: "Missing or malformed name path parameter" });
  }

  try {
    await requireAdminUser(parsedEvent.data);
    await deleteWarehouseJob(parsedParams.data.name);
    logInfo("DeleteWarehouseJobControllerCompleted", { jobName: parsedParams.data.name });
    return { statusCode: 204 };
  } catch (err) {
    logError("DeleteWarehouseJobControllerFailed", {
      jobName: parsedParams.data.name,
      error: err instanceof Error ? err.message : err,
    });
    const statusCode = err instanceof NotFoundError ? 404 : err instanceof ValidationError ? 400 : 500;
    return jsonResponse(statusCode, { message: "Failed to delete job" });
  }
};
