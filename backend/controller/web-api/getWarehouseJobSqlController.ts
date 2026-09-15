import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { WarehouseJobNameParamsSchema } from "../../models/warehouseJobRequest";
import { NotFoundError, ValidationError } from "../../models/errors";
import { getWarehouseJobSql } from "../../service/analytics/warehouseJobDefinitionService";
import { requireAdminUser } from "./requireAdminUser";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/**
 * `GET /admin/warehouse/jobs/{name}/sql` (`7-data-warehousing.md` §12b's
 * "load a job into the query editor" flow) — admin-authorized. The
 * definition row only stores an S3 key, never the SQL text inline, so
 * loading a job into the editor needs its own round trip to fetch it.
 */
export const getWarehouseJobSqlController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("GetWarehouseJobSqlControllerInvoked", { event });

  const parsedEvent = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    logError("GetWarehouseJobSqlControllerValidationFailed", { issues: parsedEvent.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  const parsedParams = WarehouseJobNameParamsSchema.safeParse(parsedEvent.data.pathParameters ?? {});
  if (!parsedParams.success) {
    logError("GetWarehouseJobSqlControllerParamsValidationFailed", { issues: parsedParams.error.issues });
    return jsonResponse(400, { message: "Missing or malformed name path parameter" });
  }

  const { name } = parsedParams.data;
  try {
    await requireAdminUser(parsedEvent.data);
    const sql = await getWarehouseJobSql(name);
    logInfo("GetWarehouseJobSqlControllerCompleted", { jobName: name });
    return jsonResponse(200, { sql });
  } catch (err) {
    logError("GetWarehouseJobSqlControllerFailed", { jobName: name, error: err instanceof Error ? err.message : err });
    const statusCode = err instanceof NotFoundError ? 404 : err instanceof ValidationError ? 400 : 500;
    return jsonResponse(statusCode, { message: "Failed to load job SQL" });
  }
};
