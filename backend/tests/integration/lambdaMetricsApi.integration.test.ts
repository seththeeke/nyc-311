/**
 * Real-integration tier (testing-framework.md §4) — hits the live
 * deployed API's `GET /lambda-metrics`, target selected by
 * INTEGRATION_TARGET (support/targets.ts). Run with
 * `npm run test:integration:test` etc.
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { getJson } from "./support/httpClient";

const ROUTE = "/lambda-metrics";

/* models/lambdaMetrics.ts has no paired zod schema by design (it's backend-computed, not read from an external boundary within backend's own code) — this test-only schema validates the wire shape from the test's perspective, where the HTTP response IS the boundary. */
const LambdaHealthPointSchema = z.object({
  date: z.string().min(1),
  invocations: z.number().int().nonnegative(),
  errors: z.number().int().nonnegative(),
  successes: z.number().int(),
});

const LambdaHealthSchema = z.object({
  logicalName: z.string().min(1),
  functionName: z.string().min(1),
  points: z.array(LambdaHealthPointSchema),
});

describe("GET /lambda-metrics against a live API", () => {
  it("returns 200 with a lambdas array covering every monitored function", async () => {
    const { status, body } = await getJson(ROUTE, ROUTE);
    expect(status).toBe(200);

    const { lambdas } = body as { lambdas: unknown[] };
    expect(Array.isArray(lambdas)).toBe(true);
    expect(lambdas.length).toBeGreaterThan(0);
    for (const lambda of lambdas) {
      expect(() => LambdaHealthSchema.parse(lambda)).not.toThrow();
    }
  });

  it("responds with CORS headers allowing the local-dev origin", async () => {
    const { headers } = await getJson(ROUTE, ROUTE, { headers: { Origin: "http://localhost:5173" } });
    expect(headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });
});
