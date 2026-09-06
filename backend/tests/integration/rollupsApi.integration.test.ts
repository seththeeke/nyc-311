/**
 * Real-integration tier (testing-framework.md §4) — hits the live
 * deployed API's `GET /data/rollups` (7-data-warehousing.md §12), target
 * selected by INTEGRATION_TARGET (support/targets.ts). Run with
 * `npm run test:integration:test` etc.
 */

import { describe, expect, it } from "vitest";
import { getJson } from "./support/httpClient";
import { AnalyticsRollupSchema } from "../../models/analyticsRollup";

const ROUTE = "/data/rollups";

describe("GET /data/rollups against a live API", () => {
  it("returns 200 with a rollups array of well-formed AnalyticsRollup rows", async () => {
    const { status, body } = await getJson(ROUTE, ROUTE);
    expect(status).toBe(200);

    const { rollups } = body as { rollups: unknown[] };
    expect(Array.isArray(rollups)).toBe(true);
    for (const rollup of rollups) {
      expect(() => AnalyticsRollupSchema.parse(rollup)).not.toThrow();
    }
  });

  it("scopes every row to a single metric_view (the sample job's)", async () => {
    const { body } = await getJson(ROUTE, ROUTE);
    const { rollups } = body as { rollups: { metric_view: string }[] };
    if (rollups.length === 0) return; /* the daily job hasn't produced a result yet — nothing to check, not a failure */

    const views = new Set(rollups.map((r) => r.metric_view));
    expect(views.size).toBe(1);
  });

  it("responds with CORS headers allowing the local-dev origin", async () => {
    const { headers } = await getJson(ROUTE, ROUTE, { headers: { Origin: "http://localhost:5173" } });
    expect(headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });
});
