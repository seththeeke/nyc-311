import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../logger";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { getFleetLocations } from "../../service/fleet/fleetLocationService";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

/**
 * `GET /fleet/locations` (`10-capacity-modeling-and-integration.md` §6.1)
 * — public, unlike `/capacity`: this is the home-page map's data source,
 * not an admin tool. No `requireAdminUser` call, same pattern as every
 * other public GET route (`getOrdersController.ts` et al.).
 */
export const getFleetLocationsController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("GetFleetLocationsControllerInvoked", { event });

  const parsedEvent = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    logError("GetFleetLocationsControllerValidationFailed", { issues: parsedEvent.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  try {
    const locations = await getFleetLocations();
    logInfo("GetFleetLocationsControllerCompleted", { operatorCount: locations.operators.length });
    return jsonResponse(200, locations);
  } catch (err) {
    logError("GetFleetLocationsControllerFailed", { error: err instanceof Error ? err.message : err });
    return jsonResponse(500, { message: "Failed to fetch fleet locations" });
  }
};
