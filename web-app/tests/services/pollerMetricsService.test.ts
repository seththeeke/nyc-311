import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("pollerMetricsService", () => {
  it("mock mode returns the baked test-data fixtures", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { pollerMetricsService } = await import("../../src/services/pollerMetricsService");
    const { MOCK_POLLER_METRICS } = await import("../../src/test-data/pollerMetrics");

    await expect(pollerMetricsService.listPollerMetrics()).resolves.toEqual(MOCK_POLLER_METRICS);
  });

  it("live mode fetches from config.apiBaseUrl + /ingestion/metrics and parses the response", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    const metrics = [
      {
        ran_at: "2026-08-15T00:00:00.000Z",
        success: true,
        records_ingested: 5,
        duplicates_skipped: 1,
        records_rejected: 0,
        error_message: null,
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ metrics }),
      })
    );

    const { pollerMetricsService } = await import("../../src/services/pollerMetricsService");

    await expect(pollerMetricsService.listPollerMetrics()).resolves.toEqual(metrics);
    expect(fetch).toHaveBeenCalledWith("https://api.example.com/ingestion/metrics");
  });

  it("live mode throws a descriptive error when the response is not ok", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const { pollerMetricsService } = await import("../../src/services/pollerMetricsService");

    await expect(pollerMetricsService.listPollerMetrics()).rejects.toThrow("HTTP 500");
  });

  it("live mode throws when the response body fails schema validation", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ not: "valid" }) })
    );

    const { pollerMetricsService } = await import("../../src/services/pollerMetricsService");

    await expect(pollerMetricsService.listPollerMetrics()).rejects.toThrow();
  });
});
