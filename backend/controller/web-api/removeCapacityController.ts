import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { RemoveCapacityParamsSchema } from "../../models/capacityRequest";
import { NotFoundError, ValidationError } from "../../models/errors";
import { removeCapacity } from "../../service/capacity/capacityService";
import { requireAdminUser } from "./requireAdminUser";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/**
 * `DELETE /capacity/{operator_id}` (`10-capacity-modeling-and-integration.md`
 * §2.1) — admin-authorized.
 */
export const removeCapacityController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("RemoveCapacityControllerInvoked", { event });

  const parsedEvent = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    logError("RemoveCapacityControllerValidationFailed", { issues: parsedEvent.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  const parsedParams = RemoveCapacityParamsSchema.safeParse(parsedEvent.data.pathParameters ?? {});
  if (!parsedParams.success) {
    logError("RemoveCapacityControllerParamsValidationFailed", { issues: parsedParams.error.issues });
    return jsonResponse(400, { message: "Missing or malformed operator_id path parameter" });
  }

  try {
    await requireAdminUser(parsedEvent.data);
    const operator = await removeCapacity(parsedParams.data.operator_id);
    logInfo("RemoveCapacityControllerCompleted", { operatorId: operator.operator_id });
    return jsonResponse(200, operator);
  } catch (err) {
    logError("RemoveCapacityControllerFailed", {
      operatorId: parsedParams.data.operator_id,
      error: err instanceof Error ? err.message : err,
    });
    const statusCode = err instanceof NotFoundError ? 404 : err instanceof ValidationError ? 400 : 500;
    return jsonResponse(statusCode, { message: "Failed to remove capacity" });
  }
};
