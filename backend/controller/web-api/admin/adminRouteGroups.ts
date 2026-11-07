import type { CognitoGroup } from "../../../models/cognitoGroup";
import type { AdminApiRouteKey } from "./adminApiRoutes";

const ADMIN_ONLY: readonly CognitoGroup[] = ["ADMIN"];
/* The COO's capacity routes (§12.3). */
const ADMIN_OR_OPERATIONS: readonly CognitoGroup[] = ["ADMIN", "BOROUGH_SIM_OPERATIONS"];
/* The CPO's contact updates, WBR reads and ad-hoc queries (§17.2, §17.3, §17.11). */
const ADMIN_OR_PRODUCT: readonly CognitoGroup[] = ["ADMIN", "BOROUGH_SIM_PRODUCT"];

/*
 * The groups each admin route allows (docs/17-executive-team.md §12.2).
 * Typed on the route-key union, so a new route can't ship without
 * declaring its groups. Everything is ADMIN-only except the capacity
 * routes, which BOROUGH_SIM_OPERATIONS (the COO) can call too (§12.3),
 * and the contact update, job-run reads and ad-hoc query, which
 * BOROUGH_SIM_PRODUCT (the CPO) can (§17.2, §17.3, §17.11).
 */
export const ADMIN_ROUTE_GROUPS: Record<AdminApiRouteKey, readonly CognitoGroup[]> = {
  "GET /admin/whoami": ADMIN_ONLY,
  "GET /capacity": ADMIN_OR_OPERATIONS,
  "GET /capacity/snapshot": ADMIN_OR_OPERATIONS,
  "POST /capacity": ADMIN_OR_OPERATIONS,
  "DELETE /capacity/{operator_id}": ADMIN_OR_OPERATIONS,
  "POST /scheduling/run": ADMIN_ONLY,
  "PATCH /admin/contacts/{contact_id}": ADMIN_OR_PRODUCT,
  "POST /admin/feature-flags": ADMIN_ONLY,
  "PUT /admin/feature-flags/{flag_key}": ADMIN_ONLY,
  "DELETE /admin/feature-flags/{flag_key}": ADMIN_ONLY,
  "POST /admin/warehouse/query": ADMIN_OR_PRODUCT,
  "GET /admin/warehouse/jobs": ADMIN_ONLY,
  "POST /admin/warehouse/jobs": ADMIN_ONLY,
  "PUT /admin/warehouse/jobs/{name}": ADMIN_ONLY,
  "DELETE /admin/warehouse/jobs/{name}": ADMIN_ONLY,
  "GET /admin/warehouse/jobs/{name}/sql": ADMIN_ONLY,
  "GET /admin/warehouse/job-runs": ADMIN_OR_PRODUCT,
  "POST /admin/warehouse/job-runs/results": ADMIN_OR_PRODUCT,
};
