import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { ValidationError } from "../../models/errors";
import { getCapacityStatus } from "../../service/capacity/capacityService";
import { requireAdminUser } from "./requireAdminUser";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/**
 * `GET /capacity` (`10-capacity-modeling-and-integration.md` §2.1) —
 * admin-authorized (the whole Capacity page lives behind `AdminRoute`,
 * §2.2 — unlike every other GET route in this project, this one isn't
 * public).
 */
export const getCapacityController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("GetCapacityControllerInvoked", { event });

  const parsedEvent = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    logError("GetCapacityControllerValidationFailed", { issues: parsedEvent.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  try {
    await requireAdminUser(parsedEvent.data);
    const status = await getCapacityStatus();
    logInfo("GetCapacityControllerCompleted", { fleetSize: status.fleet_size, availableCount: status.available_count });
    return jsonResponse(200, status);
  } catch (err) {
    logError("GetCapacityControllerFailed", { error: err instanceof Error ? err.message : err });
    const statusCode = err instanceof ValidationError ? 400 : 500;
    return jsonResponse(statusCode, { message: "Failed to fetch capacity status" });
  }
};
