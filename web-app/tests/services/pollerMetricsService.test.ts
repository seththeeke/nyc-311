import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("pollerMetricsService", () => {
  it("mock mode returns the baked test-data fixtures for metrics and cursor", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { pollerMetricsService } = await import("../../src/services/pollerMetricsService");
    const { MOCK_POLLER_METRICS, MOCK_INGESTION_CURSOR_STATUS } = await import("../../src/test-data/pollerMetrics");

    await expect(pollerMetricsService.listPollerMetrics()).resolves.toEqual({
      metrics: MOCK_POLLER_METRICS,
      cursor: MOCK_INGESTION_CURSOR_STATUS,
    });
  });

  it("live mode fetches from config.apiBaseUrl + /ingestion/metrics and parses the response envelope", async () => {
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
    const cursor = { last_watermark: "2026-08-15T18:00:00", resume_offset: null, lag_hours: 72, is_stale: false };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ metrics, cursor }),
      })
    );

    const { pollerMetricsService } = await import("../../src/services/pollerMetricsService");

    await expect(pollerMetricsService.listPollerMetrics()).resolves.toEqual({ metrics, cursor });
    expect(fetch).toHaveBeenCalledWith("https://api.example.com/ingestion/metrics");
  });

  it("live mode returns a null cursor when the response envelope has one", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ metrics: [], cursor: null }) })
    );

    const { pollerMetricsService } = await import("../../src/services/pollerMetricsService");

    await expect(pollerMetricsService.listPollerMetrics()).resolves.toEqual({ metrics: [], cursor: null });
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
