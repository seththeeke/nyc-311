import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { logError, logInfo } from "../../../logger";
import { ApiRouterEventSchema } from "../../../models/apiRouterEvent";
import { jsonResponse } from "../jsonResponse";
import { ADMIN_API_ROUTES, type AdminApiRouteKey } from "./adminApiRoutes";
import { addCapacityController } from "./addCapacityController";
import { createFeatureFlagController } from "./createFeatureFlagController";
import { createWarehouseJobController } from "./createWarehouseJobController";
import { deleteFeatureFlagController } from "./deleteFeatureFlagController";
import { deleteWarehouseJobController } from "./deleteWarehouseJobController";
import { getCapacityController } from "./getCapacityController";
import { getWarehouseJobSqlController } from "./getWarehouseJobSqlController";
import { listWarehouseJobsController } from "./listWarehouseJobsController";
import { postJobRunResultsController } from "./postJobRunResultsController";
import { removeCapacityController } from "./removeCapacityController";
import { runAdHocQueryController } from "./runAdHocQueryController";
import { runSchedulingController } from "./runSchedulingController";
import { updateFeatureFlagController } from "./updateFeatureFlagController";
import { updateWarehouseJobController } from "./updateWarehouseJobController";
import { whoamiController } from "./whoamiController";

type ApiController = (event: unknown) => Promise<APIGatewayProxyStructuredResultV2>;

/* Typed on the route-key union, so a route with no controller (or a controller with no route) fails to compile. */
const ADMIN_API_CONTROLLERS: Record<AdminApiRouteKey, ApiController> = {
  "GET /admin/whoami": whoamiController,
  "GET /capacity": getCapacityController,
  "POST /capacity": addCapacityController,
  "DELETE /capacity/{operator_id}": removeCapacityController,
  "POST /scheduling/run": runSchedulingController,
  "POST /admin/feature-flags": createFeatureFlagController,
  "PUT /admin/feature-flags/{flag_key}": updateFeatureFlagController,
  "DELETE /admin/feature-flags/{flag_key}": deleteFeatureFlagController,
  "POST /admin/warehouse/query": runAdHocQueryController,
  "GET /admin/warehouse/jobs": listWarehouseJobsController,
  "POST /admin/warehouse/jobs": createWarehouseJobController,
  "PUT /admin/warehouse/jobs/{name}": updateWarehouseJobController,
  "DELETE /admin/warehouse/jobs/{name}": deleteWarehouseJobController,
  "GET /admin/warehouse/jobs/{name}/sql": getWarehouseJobSqlController,
  "POST /admin/warehouse/job-runs/results": postJobRunResultsController,
};

function isAdminApiRouteKey(routeKey: string): routeKey is AdminApiRouteKey {
  return (ADMIN_API_ROUTES as readonly string[]).includes(routeKey);
}

/**
 * The admin Service API bundle's handler (`15-resource-consolidation.md`
 * §3.2/§4.3) — one Lambda for every JWT-authorized route. Routing only:
 * refuses an event with no JWT claims before dispatching (a public route
 * wired here by mistake is a misconfiguration, hence 500 like
 * `requireAdminUser`), then hands the raw event to that route's
 * controller, which parses and logs it in full as before.
 */
export const adminApiRouter = async (event: unknown): Promise<APIGatewayProxyStructuredResultV2> => {
  const parsedEvent = ApiRouterEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    logError("AdminApiRouterValidationFailed", { issues: parsedEvent.error.issues });
    return jsonResponse(400, { message: "Malformed request" });
  }

  const { routeKey, requestContext } = parsedEvent.data;
  const claims = requestContext.authorizer?.jwt.claims;
  if (!claims?.sub || !claims.email) {
    logError("AdminApiRouterMissingClaims", { routeKey });
    return jsonResponse(500, { message: "Internal server error" });
  }

  if (!isAdminApiRouteKey(routeKey)) {
    logError("AdminApiRouterUnknownRoute", { routeKey });
    return jsonResponse(404, { message: "Not found" });
  }

  logInfo("AdminApiRouterDispatch", { routeKey });
  const response = await ADMIN_API_CONTROLLERS[routeKey](event);
  logInfo("AdminApiRouterCompleted", { routeKey, statusCode: response.statusCode });
  return response;
};
