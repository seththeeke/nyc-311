import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../../logger";
import { ApiGatewayHttpEventSchema } from "../../../models/apiGatewayHttpEvent";
import { getCapacitySnapshot } from "../../../service/capacity/capacitySnapshotService";
import { jsonResponse } from "../shared/jsonResponse";
import { requireCapacityReader } from "./capacityCaller";

/**
 * `GET /capacity/snapshot` (docs/17-executive-team.md §12.3): the data
 * behind a capacity decision, for the admin and the COO. Facts only, no
 * recommendation.
 */
export const getCapacitySnapshotController = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  logInfo("GetCapacitySnapshotControllerInvoked", { event });
  const parsedEvent = ApiGatewayHttpEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    logError("GetCapacitySnapshotControllerValidationFailed", { issues: parsedEvent.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }
  try {
    await requireCapacityReader(parsedEvent.data);
    const snapshot = await getCapacitySnapshot();
    logInfo("GetCapacitySnapshotControllerCompleted", { fleetSize: snapshot.fleet.size, median7d: snapshot.median_days_to_resolve_7d });
    return jsonResponse(200, snapshot);
  } catch (err) {
    logError("GetCapacitySnapshotControllerFailed", { error: err instanceof Error ? err.message : err });
    return jsonResponse(500, { message: "Failed to build the capacity snapshot" });
  }
};
