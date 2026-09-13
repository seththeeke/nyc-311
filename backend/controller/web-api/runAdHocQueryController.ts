import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { AdHocQueryRequestSchema } from "../../models/adHocQueryRequest";
import { ValidationError } from "../../models/errors";
import { runAdHocQuery } from "../../service/analytics/adHocQueryService";
import { requireAdminUser } from "./requireAdminUser";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/**
 * `POST /admin/warehouse/query` (`7-data-warehousing.md` §12a, Leg 7) —
 * admin-authorized ad-hoc SQL console. Rejects a non-read-only statement
 * (`ValidationError`, mapped to `400`) before ever calling Athena; a
 * timeout or Athena-side failure maps to `500` with the underlying
 * message surfaced so the admin can see what went wrong.
 */
export const runAdHocQueryController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("RunAdHocQueryControllerInvoked", { event });

  const parsedEvent = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    logError("RunAdHocQueryControllerValidationFailed", { issues: parsedEvent.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  let rawBody: unknown = {};
  if (parsedEvent.data.body) {
    try {
      rawBody = JSON.parse(parsedEvent.data.body);
    } catch {
      logError("RunAdHocQueryControllerBodyParseFailed", {});
      return jsonResponse(400, { message: "Malformed JSON body" });
    }
  }
  const parsedBody = AdHocQueryRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    logError("RunAdHocQueryControllerBodyValidationFailed", { issues: parsedBody.error.issues });
    return jsonResponse(400, { message: "Malformed request body" });
  }

  try {
    await requireAdminUser(parsedEvent.data);
    const result = await runAdHocQuery(parsedBody.data.sql);
    logInfo("RunAdHocQueryControllerCompleted", { rowCount: result.row_count, truncated: result.truncated });
    return jsonResponse(200, result);
  } catch (err) {
    logError("RunAdHocQueryControllerFailed", { error: err instanceof Error ? err.message : err });
    if (err instanceof ValidationError) {
      return jsonResponse(400, { message: err.message });
    }
    return jsonResponse(500, { message: err instanceof Error ? err.message : "Failed to run query" });
  }
};
