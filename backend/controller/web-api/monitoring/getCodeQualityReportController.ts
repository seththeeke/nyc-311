import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../../logger";
import { ApiGatewayHttpEventSchema } from "../../../models/apiGatewayHttpEvent";
import { CodeQualityReportParamsSchema } from "../../../models/codeQualityReport";
import { NotFoundError } from "../../../models/errors";
import { getCodeQualityReport } from "../../../service/monitoring/codeQualityReportService";
import { jsonResponse } from "../shared/jsonResponse";

/** `GET /monitoring/code-quality/reports/{date}/{time}`: one of Sable's reports, in full (docs/17-executive-team.md §19.6). Public. */
export const getCodeQualityReportController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("GetCodeQualityReportControllerInvoked", { event });

  const parsedEvent = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    logError("GetCodeQualityReportControllerValidationFailed", { issues: parsedEvent.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  const parsedParams = CodeQualityReportParamsSchema.safeParse(parsedEvent.data.pathParameters ?? {});
  if (!parsedParams.success) {
    logError("GetCodeQualityReportControllerParamsValidationFailed", { issues: parsedParams.error.issues });
    return jsonResponse(400, { message: "date must be YYYY-MM-DD and time HH_MM" });
  }

  const { date, time } = parsedParams.data;
  try {
    const report = await getCodeQualityReport(date, time);
    logInfo("GetCodeQualityReportControllerCompleted", { date, time, package: report.package });
    return jsonResponse(200, report);
  } catch (err) {
    logError("GetCodeQualityReportControllerFailed", { date, time, error: err instanceof Error ? err.message : err });
    if (err instanceof NotFoundError) return jsonResponse(404, { message: "No report for that date and time" });
    return jsonResponse(500, { message: "Failed to load the code quality report" });
  }
};
