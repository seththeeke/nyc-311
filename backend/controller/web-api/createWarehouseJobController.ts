import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { CreateWarehouseJobRequestSchema } from "../../models/warehouseJobRequest";
import { TerminalError, ValidationError } from "../../models/errors";
import { createWarehouseJob } from "../../service/analytics/warehouseJobDefinitionService";
import { requireAdminUser } from "./requireAdminUser";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/**
 * `POST /admin/warehouse/jobs` (`7-data-warehousing.md` §12b, Leg 8) —
 * admin-authorized. Creates the S3 SQL file, the DDB definition row, and
 * the job's EventBridge Scheduler schedule, in that order (§8). A name
 * collision or a post-definition schedule-create failure both throw
 * `TerminalError`, mapped to `409`.
 */
export const createWarehouseJobController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("CreateWarehouseJobControllerInvoked", { event });

  const parsedEvent = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    logError("CreateWarehouseJobControllerValidationFailed", { issues: parsedEvent.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  let rawBody: unknown = {};
  if (parsedEvent.data.body) {
    try {
      rawBody = JSON.parse(parsedEvent.data.body);
    } catch {
      logError("CreateWarehouseJobControllerBodyParseFailed", {});
      return jsonResponse(400, { message: "Malformed JSON body" });
    }
  }
  const parsedBody = CreateWarehouseJobRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    logError("CreateWarehouseJobControllerBodyValidationFailed", { issues: parsedBody.error.issues });
    return jsonResponse(400, { message: "Malformed request body" });
  }

  try {
    const admin = await requireAdminUser(parsedEvent.data);
    const { name, cadence_cron, sql } = parsedBody.data;
    const definition = await createWarehouseJob(name, cadence_cron, sql, admin.user_id);
    logInfo("CreateWarehouseJobControllerCompleted", { jobName: definition.job_name });
    return jsonResponse(201, definition);
  } catch (err) {
    logError("CreateWarehouseJobControllerFailed", { error: err instanceof Error ? err.message : err });
    if (err instanceof ValidationError) return jsonResponse(400, { message: err.message });
    if (err instanceof TerminalError) return jsonResponse(409, { message: err.message });
    return jsonResponse(500, { message: "Failed to create job" });
  }
};
