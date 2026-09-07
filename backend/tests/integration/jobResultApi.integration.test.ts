/**
 * Real-integration tier (testing-framework.md §4) — hits the live
 * deployed API's `GET /data/jobs/{name}/result` (7-data-warehousing.md
 * §11), target selected by INTEGRATION_TARGET (support/targets.ts). Run
 * with `npm run test:integration:test` etc.
 */

import { describe, expect, it } from "vitest";
import { getJson } from "./support/httpClient";
import { JobResultSchema } from "../../models/jobResult";

const ROUTE = "/data/jobs/{name}/result";
const JOB = "order_volume_by_stage_7d";

describe(`GET /data/jobs/{name}/result against a live API`, () => {
  it("returns 200 with a well-formed resultset envelope for the sample job (or 404 if it has never run)", async () => {
    const { status, body } = await getJson(ROUTE, `/data/jobs/${JOB}/result`);
    expect([200, 404]).toContain(status);
    if (status === 404) return; /* job hasn't produced a resultset yet — not a failure */

    const result = JobResultSchema.parse(body);
    expect(result.job_name).toBe(JOB);
    expect(result.columns.length).toBeGreaterThan(0);
    /* every row is keyed by exactly the declared column names */
    const names = new Set(result.columns.map((c) => c.name));
    for (const row of result.rows) {
      expect(new Set(Object.keys(row))).toEqual(names);
    }
  });

  it("returns 400 for a syntactically invalid job name", async () => {
    const { status } = await getJson(ROUTE, "/data/jobs/NOT-a-valid-name/result");
    expect(status).toBe(400);
  });

  it("responds with CORS headers allowing the local-dev origin", async () => {
    const { headers } = await getJson(ROUTE, `/data/jobs/${JOB}/result`, {
      headers: { Origin: "http://localhost:5173" },
    });
    expect(headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });
});
