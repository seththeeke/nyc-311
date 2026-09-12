import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { AddCapacityRequestSchema } from "../../models/capacityRequest";
import { ValidationError } from "../../models/errors";
import { addCapacity } from "../../service/capacity/capacityService";
import { requireAdminUser } from "./requireAdminUser";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/**
 * `POST /capacity` (`10-capacity-modeling-and-integration.md` §2.1) —
 * admin-authorized. Body's `rate_per_hour` is optional; the service
 * defaults it when omitted.
 */
export const addCapacityController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("AddCapacityControllerInvoked", { event });

  const parsedEvent = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    logError("AddCapacityControllerValidationFailed", { issues: parsedEvent.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  let rawBody: unknown = {};
  if (parsedEvent.data.body) {
    try {
      rawBody = JSON.parse(parsedEvent.data.body);
    } catch {
      logError("AddCapacityControllerBodyParseFailed", {});
      return jsonResponse(400, { message: "Malformed JSON body" });
    }
  }
  const parsedBody = AddCapacityRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    logError("AddCapacityControllerBodyValidationFailed", { issues: parsedBody.error.issues });
    return jsonResponse(400, { message: "Malformed request body" });
  }

  try {
    await requireAdminUser(parsedEvent.data);
    const operator = await addCapacity(parsedBody.data.rate_per_hour);
    logInfo("AddCapacityControllerCompleted", { operatorId: operator.operator_id });
    return jsonResponse(201, operator);
  } catch (err) {
    logError("AddCapacityControllerFailed", { error: err instanceof Error ? err.message : err });
    const statusCode = err instanceof ValidationError ? 400 : 500;
    return jsonResponse(statusCode, { message: "Failed to add capacity" });
  }
};
