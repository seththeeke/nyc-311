import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { JobRunResultsRequestSchema } from "../../models/warehouseJobRunResultsRequest";
import { ValidationError } from "../../models/errors";
import { getJobRunResults } from "../../service/analytics/jobResultService";
import { requireAdminUser } from "./requireAdminUser";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/**
 * `POST /admin/warehouse/job-runs/results` (`7-data-warehousing.md` §12b's
 * Reports tab addition) — admin-authorized bulk fetch of raw job-run
 * results by `job_run_id`, sized for a future multi-report dashboard.
 * Each requested id is resolved independently by the service, so a
 * missing/failed one only shows up as that item's own `error` field, not
 * a failure of the whole request.
 */
export const postJobRunResultsController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("PostJobRunResultsControllerInvoked", { event });

  const parsedEvent = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    logError("PostJobRunResultsControllerValidationFailed", { issues: parsedEvent.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  let rawBody: unknown = {};
  if (parsedEvent.data.body) {
    try {
      rawBody = JSON.parse(parsedEvent.data.body);
    } catch {
      logError("PostJobRunResultsControllerBodyParseFailed", {});
      return jsonResponse(400, { message: "Malformed JSON body" });
    }
  }
  const parsedBody = JobRunResultsRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    logError("PostJobRunResultsControllerBodyValidationFailed", { issues: parsedBody.error.issues });
    return jsonResponse(400, { message: "Malformed request body" });
  }

  try {
    await requireAdminUser(parsedEvent.data);
    const results = await getJobRunResults(parsedBody.data.job_run_ids);
    logInfo("PostJobRunResultsControllerCompleted", { count: results.length });
    return jsonResponse(200, { results });
  } catch (err) {
    logError("PostJobRunResultsControllerFailed", { error: err instanceof Error ? err.message : err });
    if (err instanceof ValidationError) {
      return jsonResponse(400, { message: err.message });
    }
    return jsonResponse(500, { message: err instanceof Error ? err.message : "Failed to load job run results" });
  }
};
