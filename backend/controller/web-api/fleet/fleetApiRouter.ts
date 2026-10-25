import { createApiRouter } from "../shared/createApiRouter";
import type { FleetApiRouteKey } from "./fleetApiRoutes";
import { getFleetLocationsController } from "./getFleetLocationsController";

/** The fleet Service API bundle's Lambda handler (15-resource-consolidation.md §3.3). */
export const fleetApiRouter = createApiRouter<FleetApiRouteKey>("FleetApi", {
  "GET /fleet/locations": getFleetLocationsController,
});
