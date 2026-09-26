/**
 * Real-integration tier (testing-framework.md §4) — hits the live
 * deployed API's `GET /workspace/metrics`, target selected by
 * INTEGRATION_TARGET (support/targets.ts). Run with
 * `npm run test:integration:test` etc.
 */

import { describe, expect, it } from "vitest";
import { getJson } from "./support/httpClient";
import { WorkspaceMetricsSchema } from "../../models/workspaceMetrics";

const ROUTE = "/workspace/metrics";

describe("GET /workspace/metrics against a live API", () => {
  it("returns 200 with well-formed metrics (all-null if the wbr job hasn't run in this environment)", async () => {
    const { status, body } = await getJson(ROUTE, ROUTE);
    expect(status).toBe(200);

    const metrics = WorkspaceMetricsSchema.parse(body);
    expect(metrics.source_job).toBe("wbr");
    if (metrics.week_start !== null && metrics.previous_week_start !== null) {
      expect(metrics.week_start > metrics.previous_week_start).toBe(true);
    }
  });

  it("responds with CORS headers allowing the local-dev origin", async () => {
    const { headers } = await getJson(ROUTE, ROUTE, { headers: { Origin: "http://localhost:5173" } });
    expect(headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });
});
