import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { getJobResult } from "../../service/analytics/jobResultService";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { ValidationError } from "../../models/errors";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/* Job names are the `.sql` file basenames — lower_snake_case only (models/warehouseJob.ts). */
const JOB_NAME_PATTERN = /^[a-z0-9_]+$/;

/**
 * `GET /data/jobs/{name}/result` (`7-data-warehousing.md` §11) — the
 * latest `SUCCEEDED` run's resultset envelope for a job, `s3:GetObject`'d
 * and returned unchanged. `404` if the job has never produced one,
 * read-only.
 */
export const getJobResultController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("GetJobResultControllerInvoked", { event });

  const parsed = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsed.success) {
    logError("GetJobResultControllerValidationFailed", { issues: parsed.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  const jobName = parsed.data.pathParameters?.["name"];
  if (!jobName || !JOB_NAME_PATTERN.test(jobName)) {
    logError("GetJobResultControllerBadJobName", { jobName });
    return jsonResponse(400, { message: "Invalid job name" });
  }

  try {
    const result = await getJobResult(jobName);
    if (!result) {
      return jsonResponse(404, { message: `No result for job '${jobName}' yet` });
    }
    logInfo("GetJobResultControllerCompleted", { jobName, runDate: result.run_date, rowCount: result.rows.length });
    return jsonResponse(200, result);
  } catch (err) {
    logError("GetJobResultControllerFailed", { jobName, error: err instanceof Error ? err.message : err });
    const statusCode = err instanceof ValidationError ? 400 : 500;
    return jsonResponse(statusCode, { message: "Failed to fetch job result" });
  }
};
