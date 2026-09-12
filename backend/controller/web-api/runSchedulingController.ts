import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { ValidationError } from "../../models/errors";
import { scheduleOrders } from "../../service/scheduling/orderSchedulingService";
import { requireAdminUser } from "./requireAdminUser";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/**
 * `POST /scheduling/run` (`10-capacity-modeling-and-integration.md` §5.1)
 * — admin-authorized on-demand trigger for `scheduleOrders`, the same
 * service function the `rate(1 hour)` EventBridge Schedule already calls
 * (`scheduleOrdersController.ts`). For testing purposes only — the
 * response's `SchedulingRunSummary` is deliberately not surfaced as a
 * dashboard/stats feature yet (§5.1, explicitly deferred).
 */
export const runSchedulingController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("RunSchedulingControllerInvoked", { event });

  const parsedEvent = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    logError("RunSchedulingControllerValidationFailed", { issues: parsedEvent.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  try {
    await requireAdminUser(parsedEvent.data);
    const summary = await scheduleOrders();
    logInfo("RunSchedulingControllerCompleted", { summary });
    return jsonResponse(200, summary);
  } catch (err) {
    logError("RunSchedulingControllerFailed", { error: err instanceof Error ? err.message : err });
    const statusCode = err instanceof ValidationError ? 400 : 500;
    return jsonResponse(statusCode, { message: "Failed to run scheduling" });
  }
};
