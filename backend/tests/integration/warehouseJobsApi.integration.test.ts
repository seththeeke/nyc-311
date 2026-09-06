/**
 * Real-integration tier (testing-framework.md §4) — hits the live
 * deployed API's `GET /data/jobs` (7-data-warehousing.md §12), target
 * selected by INTEGRATION_TARGET (support/targets.ts). Run with
 * `npm run test:integration:test` etc.
 */

import { describe, expect, it } from "vitest";
import { getJson } from "./support/httpClient";
import { WarehouseJobRunSchema } from "../../models/warehouseJobRun";

const ROUTE = "/data/jobs";

describe("GET /data/jobs against a live API", () => {
  it("returns 200 with a jobRuns array of well-formed WarehouseJobRun records", async () => {
    const { status, body } = await getJson(ROUTE, ROUTE);
    expect(status).toBe(200);

    const { jobRuns } = body as { jobRuns: unknown[] };
    expect(Array.isArray(jobRuns)).toBe(true);
    for (const run of jobRuns) {
      expect(() => WarehouseJobRunSchema.parse(run)).not.toThrow();
    }
  });

  it("returns job runs most-recent-first", async () => {
    const { body } = await getJson(ROUTE, ROUTE);
    const { jobRuns } = body as { jobRuns: { started_at: string }[] };

    for (let i = 1; i < jobRuns.length; i++) {
      expect(jobRuns[i - 1].started_at >= jobRuns[i].started_at).toBe(true);
    }
  });

  it("responds with CORS headers allowing the local-dev origin", async () => {
    const { headers } = await getJson(ROUTE, ROUTE, { headers: { Origin: "http://localhost:5173" } });
    expect(headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });
});
