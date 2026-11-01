import { CloudWatchClient, GetMetricDataCommand } from "@aws-sdk/client-cloudwatch";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicApiMetricsSchema } from "../../../models/publicApiMetrics";
import { getPublicApiMetrics } from "../../../service/monitoring/publicApiMetricsService";

const cwMock = mockClient(CloudWatchClient);
const NOW = new Date("2026-11-02T22:14:00.000Z");
const HOUR_A = new Date("2026-11-02T21:00:00.000Z");
const HOUR_B = new Date("2026-11-02T22:00:00.000Z");

beforeEach(() => {
  cwMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getPublicApiMetrics", () => {
  it("returns 24 hourly points and whole-day totals from the API's built-in metrics", async () => {
    cwMock.on(GetMetricDataCommand).resolves({
      MetricDataResults: [
        { Id: "requests", Timestamps: [HOUR_B, HOUR_A], Values: [5, 3] },
        { Id: "clientErrors", Timestamps: [HOUR_A], Values: [1] },
        { Id: "serverErrors", Timestamps: [], Values: [] },
        { Id: "p50", Timestamps: [HOUR_A], Values: [40] },
        { Id: "p99", Timestamps: [HOUR_A, HOUR_B], Values: [120] },
        { Id: "totalP50", Timestamps: [HOUR_A], Values: [42] },
        { Id: "totalP99", Timestamps: [HOUR_A], Values: [130] },
      ],
    });
    const metrics = await getPublicApiMetrics({ client: new CloudWatchClient({}), now: () => new Date(NOW), apiId: "abc123" });

    expect(PublicApiMetricsSchema.safeParse(metrics).success).toBe(true);
    expect(metrics.points).toHaveLength(24);
    expect(metrics.points[0].timestamp).toBe("2026-11-01T23:00:00.000Z");
    expect(metrics.points.find((p) => p.timestamp === HOUR_A.toISOString())).toEqual({
      timestamp: HOUR_A.toISOString(),
      requests: 3,
      client_errors: 1,
      server_errors: 0,
      latency_p50_ms: 40,
      latency_p99_ms: 120,
    });
    expect(metrics.points.at(-1)).toMatchObject({ requests: 5, latency_p50_ms: null, latency_p99_ms: null });
    expect(metrics.totals).toEqual({ requests: 8, client_errors: 1, server_errors: 0, latency_p50_ms: 42, latency_p99_ms: 130 });

    const input = cwMock.commandCalls(GetMetricDataCommand)[0].args[0].input;
    expect(input.EndTime).toEqual(new Date("2026-11-02T23:00:00.000Z"));
    expect(input.MetricDataQueries?.[0].MetricStat?.Metric?.Dimensions).toEqual([{ Name: "ApiId", Value: "abc123" }]);
  });

  it("reports zeros and null latency for a day with no traffic", async () => {
    cwMock.on(GetMetricDataCommand).resolves({});
    process.env.PUBLIC_API_ID = "env-api";
    try {
      const metrics = await getPublicApiMetrics();
      expect(metrics.totals).toEqual({ requests: 0, client_errors: 0, server_errors: 0, latency_p50_ms: null, latency_p99_ms: null });
    } finally {
      delete process.env.PUBLIC_API_ID;
    }
    expect(cwMock.commandCalls(GetMetricDataCommand)[0].args[0].input.MetricDataQueries?.[0].MetricStat?.Metric?.Dimensions).toEqual([
      { Name: "ApiId", Value: "env-api" },
    ]);
  });
});
