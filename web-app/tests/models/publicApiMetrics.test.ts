import { describe, expect, it } from "vitest";
import { PublicApiMetricsSchema } from "../../src/models/publicApiMetrics";
import { MOCK_PUBLIC_API_METRICS } from "../../src/test-data/publicApiMetrics";

describe("PublicApiMetricsSchema", () => {
  it("accepts the mock day, and null latency for a quiet hour", () => {
    expect(PublicApiMetricsSchema.parse(MOCK_PUBLIC_API_METRICS).points).toHaveLength(24);
    const quiet = { ...MOCK_PUBLIC_API_METRICS.points[0], requests: 0, latency_p50_ms: null, latency_p99_ms: null };
    expect(PublicApiMetricsSchema.safeParse({ ...MOCK_PUBLIC_API_METRICS, points: [quiet] }).success).toBe(true);
  });

  it("rejects negative counts", () => {
    const bad = { ...MOCK_PUBLIC_API_METRICS, totals: { ...MOCK_PUBLIC_API_METRICS.totals, requests: -1 } };
    expect(PublicApiMetricsSchema.safeParse(bad).success).toBe(false);
  });
});
