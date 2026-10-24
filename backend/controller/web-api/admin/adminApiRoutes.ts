/**
 * Every route the admin Service API bundle serves (`15-resource-consolidation.md`
 * §4.2) — the one list both `adminApiRouter`'s dispatch table and cdk/'s
 * route wiring are built from, so the two can't drift. Must stay
 * import-free (lint-enforced): cdk/ imports this file directly.
 */
export const ADMIN_API_ROUTES = [
  "GET /admin/whoami",
  "GET /capacity",
  "POST /capacity",
  "DELETE /capacity/{operator_id}",
  "POST /scheduling/run",
  "POST /admin/feature-flags",
  "PUT /admin/feature-flags/{flag_key}",
  "DELETE /admin/feature-flags/{flag_key}",
  "POST /admin/warehouse/query",
  "GET /admin/warehouse/jobs",
  "POST /admin/warehouse/jobs",
  "PUT /admin/warehouse/jobs/{name}",
  "DELETE /admin/warehouse/jobs/{name}",
  "GET /admin/warehouse/jobs/{name}/sql",
  "POST /admin/warehouse/job-runs/results",
] as const;

export type AdminApiRouteKey = (typeof ADMIN_API_ROUTES)[number];
