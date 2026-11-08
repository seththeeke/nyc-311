import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../../logger";
import { ApiGatewayHttpEventSchema } from "../../../models/apiGatewayHttpEvent";
import { listCodeQualityReports } from "../../../service/monitoring/codeQualityReportService";
import { jsonResponse } from "../shared/jsonResponse";

/** `GET /monitoring/code-quality/reports`: the Code Quality page's list of Sable's reports, newest first (docs/17-executive-team.md §19.6). Public. */
export const getCodeQualityReportsController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("GetCodeQualityReportsControllerInvoked", { event });

  const parsed = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsed.success) {
    logError("GetCodeQualityReportsControllerValidationFailed", { issues: parsed.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  try {
    const reports = await listCodeQualityReports();
    logInfo("GetCodeQualityReportsControllerCompleted", { count: reports.length });
    return jsonResponse(200, { reports });
  } catch (err) {
    logError("GetCodeQualityReportsControllerFailed", { error: err instanceof Error ? err.message : err });
    return jsonResponse(500, { message: "Failed to list code quality reports" });
  }
};
