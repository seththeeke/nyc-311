import { afterEach, describe, expect, it, vi } from "vitest";
import { MOCK_PUBLIC_API_METRICS } from "../../src/test-data/publicApiMetrics";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("publicApiMetricsService", () => {
  it("mock mode returns the baked day", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { publicApiMetricsService } = await import("../../src/services/publicApiMetricsService");
    await expect(publicApiMetricsService.getMetrics()).resolves.toEqual(MOCK_PUBLIC_API_METRICS);
  });

  it("live mode reads /public-api/metrics from the web-app's API and parses it", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => MOCK_PUBLIC_API_METRICS }));
    const { publicApiMetricsService } = await import("../../src/services/publicApiMetricsService");
    await expect(publicApiMetricsService.getMetrics()).resolves.toEqual(MOCK_PUBLIC_API_METRICS);
    expect(fetch).toHaveBeenCalledWith("https://api.example.com/public-api/metrics");
  });

  it("live mode throws on a failed response", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502 }));
    const { publicApiMetricsService } = await import("../../src/services/publicApiMetricsService");
    await expect(publicApiMetricsService.getMetrics()).rejects.toThrow("HTTP 502");
  });
});
