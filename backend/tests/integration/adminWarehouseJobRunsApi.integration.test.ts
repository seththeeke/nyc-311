/**
 * Real-integration tier (testing-framework.md §4) — hits the live
 * deployed API's admin `GET /admin/warehouse/job-runs`, which replaced
 * public `GET /data/jobs` (`15-resource-consolidation.md` §3.3). Skipped
 * for `INTEGRATION_TARGET=local`, which enforces no JWT authorizer (see
 * adminWhoamiApi.integration.test.ts).
 */

import { describe, expect, it } from "vitest";
import { getJson } from "./support/httpClient";
import { getTestAdminIdToken } from "./support/testAdminAuth";
import { WarehouseJobRunSchema } from "../../models/warehouseJobRun";

const ROUTE = "/admin/warehouse/job-runs";

describe.skipIf(process.env.INTEGRATION_TARGET === "local")("GET /admin/warehouse/job-runs against a live API", () => {
  it("returns 200 with well-formed WarehouseJobRun records, most-recent-first, for the test admin", async () => {
    const idToken = await getTestAdminIdToken();

    const { status, body } = await getJson(ROUTE, ROUTE, { headers: { Authorization: `Bearer ${idToken}` } });

    expect(status).toBe(200);
    const { jobRuns } = body as { jobRuns: { started_at: string }[] };
    expect(Array.isArray(jobRuns)).toBe(true);
    for (const run of jobRuns) {
      expect(() => WarehouseJobRunSchema.parse(run)).not.toThrow();
    }
    for (let i = 1; i < jobRuns.length; i++) {
      expect(jobRuns[i - 1].started_at >= jobRuns[i].started_at).toBe(true);
    }
  });

  it("returns 401 with no Authorization header at all", async () => {
    const { status } = await getJson(ROUTE, ROUTE);
    expect(status).toBe(401);
  });
});
