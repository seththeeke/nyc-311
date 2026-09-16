import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { UpdateWarehouseJobRequestSchema, WarehouseJobNameParamsSchema } from "../../models/warehouseJobRequest";
import { NotFoundError, TerminalError, ValidationError } from "../../models/errors";
import { updateWarehouseJob } from "../../service/analytics/warehouseJobDefinitionService";
import { requireAdminUser } from "./requireAdminUser";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/**
 * `PUT /admin/warehouse/jobs/{name}` (`7-data-warehousing.md` §12b's
 * job-edit flow) — admin-authorized. Overwrites the job's S3 SQL file
 * and its EventBridge Scheduler cadence, then its DDB definition row.
 * The job's name/identity never changes here — only `cadence_cron`/`sql`
 * are in the request body.
 */
export const updateWarehouseJobController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("UpdateWarehouseJobControllerInvoked", { event });

  const parsedEvent = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    logError("UpdateWarehouseJobControllerValidationFailed", { issues: parsedEvent.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  const parsedParams = WarehouseJobNameParamsSchema.safeParse(parsedEvent.data.pathParameters ?? {});
  if (!parsedParams.success) {
    logError("UpdateWarehouseJobControllerParamsValidationFailed", { issues: parsedParams.error.issues });
    return jsonResponse(400, { message: "Missing or malformed name path parameter" });
  }

  let rawBody: unknown = {};
  if (parsedEvent.data.body) {
    try {
      rawBody = JSON.parse(parsedEvent.data.body);
    } catch {
      logError("UpdateWarehouseJobControllerBodyParseFailed", {});
      return jsonResponse(400, { message: "Malformed JSON body" });
    }
  }
  const parsedBody = UpdateWarehouseJobRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    logError("UpdateWarehouseJobControllerBodyValidationFailed", { issues: parsedBody.error.issues });
    return jsonResponse(400, { message: "Malformed request body" });
  }

  const { name } = parsedParams.data;
  try {
    await requireAdminUser(parsedEvent.data);
    const definition = await updateWarehouseJob(name, parsedBody.data.sql, parsedBody.data.cadence_cron);
    logInfo("UpdateWarehouseJobControllerCompleted", { jobName: definition.job_name });
    return jsonResponse(200, definition);
  } catch (err) {
    logError("UpdateWarehouseJobControllerFailed", { jobName: name, error: err instanceof Error ? err.message : err });
    if (err instanceof NotFoundError) return jsonResponse(404, { message: err.message });
    if (err instanceof ValidationError) return jsonResponse(400, { message: err.message });
    if (err instanceof TerminalError) return jsonResponse(409, { message: err.message });
    return jsonResponse(500, { message: "Failed to update job" });
  }
};
