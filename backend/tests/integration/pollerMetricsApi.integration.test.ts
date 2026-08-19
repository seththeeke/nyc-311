/**
 * Real-integration tier (testing-framework.md §4) — hits the deployed
 * Nyc311-Test API over the network. Skips (not fails) when NYC311_API_URL
 * isn't set (see test-scripts/2-metrics-api-test.py to look it up).
 * Run with: NYC311_API_URL=<url> npm run test:integration
 */

import { describe, expect, it } from "vitest";
import { PollerMetricsSchema } from "../../models/pollerMetrics";

const API_URL = process.env.NYC311_API_URL;
const METRICS_ROUTE = "/ingestion/metrics";

describe.skipIf(!API_URL)("GET /ingestion/metrics against a live Nyc311-Test", () => {
  it("returns 200 with a metrics array whose items all match PollerMetricsSchema", async () => {
    const response = await fetch(`${API_URL}${METRICS_ROUTE}`);
    expect(response.status).toBe(200);

    const body = (await response.json()) as { metrics: unknown[] };
    expect(Array.isArray(body.metrics)).toBe(true);
    for (const item of body.metrics) {
      expect(() => PollerMetricsSchema.parse(item)).not.toThrow();
    }
  });

  it("returns metrics sorted most-recent-first", async () => {
    const response = await fetch(`${API_URL}${METRICS_ROUTE}`);
    const body = (await response.json()) as { metrics: { ran_at: string }[] };

    for (let i = 1; i < body.metrics.length; i++) {
      expect(body.metrics[i - 1].ran_at >= body.metrics[i].ran_at).toBe(true);
    }
  });

  it("responds with CORS headers allowing the local-dev origin", async () => {
    const response = await fetch(`${API_URL}${METRICS_ROUTE}`, {
      headers: { Origin: "http://localhost:5173" },
    });
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });
});
