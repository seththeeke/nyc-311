import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { getPipelineStatus } from "../../service/pipeline/pipelineStatusService";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { jsonResponse } from "./shared/jsonResponse";
import { errorResponse } from "./shared/errorResponse";

/**
 * Entry point for `GET /pipeline/status` — a read-only mirror of
 * Nyc311Pipeline's AWS console status view (2-pipeline-monitoring.md).
 * Validates the HTTP API v2 proxy event first (CLAUDE.md §5.2), delegates
 * to `getPipelineStatus`, and maps any failure to an HTTP status code —
 * same shape as `getPollerMetricsController.ts`. Never touches the
 * CodePipeline SDK client directly (CLAUDE.md §5.2's "always go through a
 * service" rule).
 */
export const getPipelineStatusController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("GetPipelineStatusControllerInvoked", { event });

  const parsed = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsed.success) {
    logError("GetPipelineStatusControllerValidationFailed", { issues: parsed.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  try {
    const status = await getPipelineStatus();
    logInfo("GetPipelineStatusControllerCompleted", {
      stageCount: status.stages.length,
      executionCount: status.executions.length,
    });
    return jsonResponse(200, status);
  } catch (err) {
    logError("GetPipelineStatusControllerFailed", { error: err instanceof Error ? err.message : err });
    return errorResponse(err, "Failed to fetch pipeline status");
  }
};
