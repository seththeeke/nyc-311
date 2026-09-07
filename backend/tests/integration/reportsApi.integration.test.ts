/**
 * Real-integration tier (testing-framework.md §4) — hits the live
 * deployed API's `GET /reports` (7-data-warehousing.md §12), target
 * selected by INTEGRATION_TARGET (support/targets.ts). Run with
 * `npm run test:integration:test` etc.
 */

import { describe, expect, it } from "vitest";
import { getJson } from "./support/httpClient";
import { ReportsResponseSchema } from "../../models/report";

const ROUTE = "/reports";

describe("GET /reports against a live API", () => {
  it("returns 200 with a well-formed reports payload", async () => {
    const { status, body } = await getJson(ROUTE, ROUTE);
    expect(status).toBe(200);

    const parsed = ReportsResponseSchema.parse(body);
    for (const report of parsed.reports) {
      /* weeks are ordered oldest-first and every values key is a declared series */
      const seriesSet = new Set(report.series);
      for (const wk of report.weeks) {
        for (const key of Object.keys(wk.values)) expect(seriesSet.has(key)).toBe(true);
      }
      const weekKeys = report.weeks.map((w) => w.week);
      expect(weekKeys).toEqual([...weekKeys].sort());
    }
  });

  it("responds with CORS headers allowing the local-dev origin", async () => {
    const { headers } = await getJson(ROUTE, ROUTE, { headers: { Origin: "http://localhost:5173" } });
    expect(headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });
});
