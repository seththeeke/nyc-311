/**
 * Real-integration tier (testing-framework.md §4) — hits the live
 * deployed API's `GET /data/schema` (7-data-warehousing.md §12), target
 * selected by INTEGRATION_TARGET (support/targets.ts). Run with
 * `npm run test:integration:test` etc.
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { getJson } from "./support/httpClient";

const ROUTE = "/data/schema";

/* The schema endpoint reads Glue live; there's no backend model for it, so this test-only schema validates the wire shape. */
const WarehouseColumnSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  comment: z.string().nullable(),
});
const WarehouseTableSchema = z.object({
  table_name: z.string().min(1),
  columns: z.array(WarehouseColumnSchema),
});

describe("GET /data/schema against a live API", () => {
  it("returns 200 with a tables array covering the three source tables plus job_results", async () => {
    const { status, body } = await getJson(ROUTE, ROUTE);
    expect(status).toBe(200);

    const { tables } = body as { tables: unknown[] };
    expect(Array.isArray(tables)).toBe(true);
    for (const table of tables) {
      expect(() => WarehouseTableSchema.parse(table)).not.toThrow();
    }

    const names = new Set((tables as { table_name: string }[]).map((t) => t.table_name));
    for (const expected of ["order_events", "order_snapshots", "requests", "job_results"]) {
      expect(names.has(expected)).toBe(true);
    }
  });

  it("responds with CORS headers allowing the local-dev origin", async () => {
    const { headers } = await getJson(ROUTE, ROUTE, { headers: { Origin: "http://localhost:5173" } });
    expect(headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });
});
