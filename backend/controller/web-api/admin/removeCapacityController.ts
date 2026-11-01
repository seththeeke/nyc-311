import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../../logger";
import { ApiGatewayHttpEventSchema } from "../../../models/apiGatewayHttpEvent";
import { RemoveCapacityBodySchema, RemoveCapacityParamsSchema } from "../../../models/capacityRequest";
import { ConflictError, NotFoundError, ValidationError } from "../../../models/errors";
import { removeCapacity } from "../../../service/capacity/capacityService";
import { capacityChangeOf } from "./capacityCaller";
import { jsonResponse } from "../shared/jsonResponse";

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

  let rawBody: unknown = {};
  try {
    rawBody = parsedEvent.data.body ? JSON.parse(parsedEvent.data.body) : {};
  } catch {
    logError("RemoveCapacityControllerBodyParseFailed", {});
    return jsonResponse(400, { message: "Malformed JSON body" });
  }
  const parsedBody = RemoveCapacityBodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    logError("RemoveCapacityControllerBodyValidationFailed", { issues: parsedBody.error.issues });
    return jsonResponse(400, { message: "Malformed request body" });
  }

  try {
    const change = await capacityChangeOf(parsedEvent.data, parsedBody.data.reason);
    const operator = await removeCapacity(parsedParams.data.operator_id, {}, change);
    logInfo("RemoveCapacityControllerCompleted", { operatorId: operator.operator_id });
    return jsonResponse(200, operator);
  } catch (err) {
    logError("RemoveCapacityControllerFailed", {
      operatorId: parsedParams.data.operator_id,
      error: err instanceof Error ? err.message : err,
    });
    if (err instanceof NotFoundError) return jsonResponse(404, { message: "Failed to remove capacity" });
    if (err instanceof ConflictError) return jsonResponse(409, { message: err.message });
    if (err instanceof ValidationError) return jsonResponse(400, { message: err.message });
    return jsonResponse(500, { message: "Failed to remove capacity" });
  }
};
