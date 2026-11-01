import type { CognitoGroup } from "../../../models/cognitoGroup";
import type { AdminApiRouteKey } from "./adminApiRoutes";

const ADMIN_ONLY: readonly CognitoGroup[] = ["ADMIN"];

/*
 * The groups each admin route allows (docs/17-executive-team.md §12.2).
 * Typed on the route-key union, so a new route can't ship without
 * declaring its groups. Everything is ADMIN-only until the COO's
 * capacity routes open to BOROUGH_SIM_OPERATIONS (§12.3).
 */
export const ADMIN_ROUTE_GROUPS: Record<AdminApiRouteKey, readonly CognitoGroup[]> = {
  "GET /admin/whoami": ADMIN_ONLY,
  "GET /capacity": ADMIN_ONLY,
  "POST /capacity": ADMIN_ONLY,
  "DELETE /capacity/{operator_id}": ADMIN_ONLY,
  "POST /scheduling/run": ADMIN_ONLY,
  "POST /admin/feature-flags": ADMIN_ONLY,
  "PUT /admin/feature-flags/{flag_key}": ADMIN_ONLY,
  "DELETE /admin/feature-flags/{flag_key}": ADMIN_ONLY,
  "POST /admin/warehouse/query": ADMIN_ONLY,
  "GET /admin/warehouse/jobs": ADMIN_ONLY,
  "POST /admin/warehouse/jobs": ADMIN_ONLY,
  "PUT /admin/warehouse/jobs/{name}": ADMIN_ONLY,
  "DELETE /admin/warehouse/jobs/{name}": ADMIN_ONLY,
  "GET /admin/warehouse/jobs/{name}/sql": ADMIN_ONLY,
  "GET /admin/warehouse/job-runs": ADMIN_ONLY,
  "POST /admin/warehouse/job-runs/results": ADMIN_ONLY,
};
