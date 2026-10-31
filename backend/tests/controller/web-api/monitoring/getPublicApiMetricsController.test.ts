import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../service/monitoring/publicApiMetricsService", () => ({ getPublicApiMetrics: vi.fn() }));

import { getPublicApiMetricsController } from "../../../../controller/web-api/monitoring/getPublicApiMetricsController";
import { getPublicApiMetrics } from "../../../../service/monitoring/publicApiMetricsService";

const event = { rawPath: "/public-api/metrics", requestContext: { http: { method: "GET" } } };
const metrics = {
  window_hours: 24,
  period_seconds: 3600,
  totals: { requests: 3, client_errors: 1, server_errors: 0, latency_p50_ms: 40, latency_p99_ms: 120 },
  points: [],
};

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getPublicApiMetrics).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getPublicApiMetricsController", () => {
  it("returns the metrics", async () => {
    vi.mocked(getPublicApiMetrics).mockResolvedValue(metrics);
    const response = await getPublicApiMetricsController(event);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(String(response.body))).toEqual(metrics);
  });

  it("rejects a malformed event", async () => {
    expect((await getPublicApiMetricsController({})).statusCode).toBe(400);
  });

  it.each([new Error("throttled"), "boom"])("maps a failure (%s) to 500", async (failure) => {
    vi.mocked(getPublicApiMetrics).mockRejectedValue(failure);
    expect((await getPublicApiMetricsController(event)).statusCode).toBe(500);
  });
});
