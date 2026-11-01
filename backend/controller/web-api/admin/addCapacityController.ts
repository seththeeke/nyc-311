import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../../logger";
import { ApiGatewayHttpEventSchema } from "../../../models/apiGatewayHttpEvent";
import { AddCapacityRequestSchema } from "../../../models/capacityRequest";
import { ConflictError, ValidationError } from "../../../models/errors";
import { addCapacity } from "../../../service/capacity/capacityService";
import { capacityChangeOf } from "./capacityCaller";
import { jsonResponse } from "../shared/jsonResponse";

/**
 * `POST /capacity` (`10-capacity-modeling-and-integration.md` §2.1) —
 * admin-authorized. Body's `name` is required (not unique — the only way
 * to identify this Operator past its id); `rate_per_hour` is optional,
 * the service defaults it when omitted.
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
    const change = await capacityChangeOf(parsedEvent.data, parsedBody.data.reason);
    const operator = await addCapacity(parsedBody.data.name, parsedBody.data.rate_per_hour, {}, change);
    logInfo("AddCapacityControllerCompleted", { operatorId: operator.operator_id });
    return jsonResponse(201, operator);
  } catch (err) {
    logError("AddCapacityControllerFailed", { error: err instanceof Error ? err.message : err });
    /* The COO reads these messages: a 409 names the daily cap it hit (docs/17-executive-team.md §12.3). */
    if (err instanceof ConflictError) return jsonResponse(409, { message: err.message });
    if (err instanceof ValidationError) return jsonResponse(400, { message: err.message });
    return jsonResponse(500, { message: "Failed to add capacity" });
  }
};
