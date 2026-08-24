/**
 * Real-integration tier (testing-framework.md §4) — hits the live
 * deployed API's `GET /ingestion/metrics`, target selected by
 * INTEGRATION_TARGET (support/targets.ts): `local` (sam local start-api),
 * `test`, or `prod`. Run with `npm run test:integration:test` etc.
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { getJson } from "./support/httpClient";
import { PollerMetricsSchema } from "../../models/pollerMetrics";

const ROUTE = "/ingestion/metrics";

/* IngestionCursorStatus (models/ingestionCursor.ts) has no paired zod schema by design — this test-only schema validates the wire shape without relitigating that. */
const CursorStatusSchema = z.object({
  last_watermark: z.string().min(1).nullable(),
  resume_offset: z.number().int().nonnegative().nullable(),
  lag_hours: z.number().nullable(),
  is_stale: z.boolean(),
});

describe("GET /ingestion/metrics against a live API", () => {
  it("returns 200 with a metrics array whose items all match PollerMetricsSchema, and a valid cursor", async () => {
    const { status, body } = await getJson(ROUTE, ROUTE);
    expect(status).toBe(200);

    const { metrics, cursor } = body as { metrics: unknown[]; cursor: unknown };
    expect(Array.isArray(metrics)).toBe(true);
    for (const item of metrics) {
      expect(() => PollerMetricsSchema.parse(item)).not.toThrow();
    }
    if (cursor !== null) {
      expect(() => CursorStatusSchema.parse(cursor)).not.toThrow();
    }
  });

  it("returns metrics sorted most-recent-first", async () => {
    const { body } = await getJson(ROUTE, ROUTE);
    const { metrics } = body as { metrics: { ran_at: string }[] };

    for (let i = 1; i < metrics.length; i++) {
      expect(metrics[i - 1].ran_at >= metrics[i].ran_at).toBe(true);
    }
  });

  it("responds with CORS headers allowing the local-dev origin", async () => {
    const { headers } = await getJson(ROUTE, ROUTE, { headers: { Origin: "http://localhost:5173" } });
    expect(headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });
});
