import { afterEach, describe, expect, it, vi } from "vitest";
import { MOCK_WORKSPACE_METRICS } from "../../src/test-data/workspaceMetrics";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("workspaceMetricsService", () => {
  it("mock mode returns the baked fixture", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { workspaceMetricsService } = await import("../../src/services/workspaceMetricsService");

    await expect(workspaceMetricsService.getWorkspaceMetrics()).resolves.toEqual(MOCK_WORKSPACE_METRICS);
  });

  it("live mode fetches config.apiBaseUrl + /workspace/metrics and parses the response", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => MOCK_WORKSPACE_METRICS }));
    const { workspaceMetricsService } = await import("../../src/services/workspaceMetricsService");

    await expect(workspaceMetricsService.getWorkspaceMetrics()).resolves.toEqual(MOCK_WORKSPACE_METRICS);
    expect(fetch).toHaveBeenCalledWith("https://api.example.com/workspace/metrics");
  });

  it("live mode throws a descriptive error when the response is not ok", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const { workspaceMetricsService } = await import("../../src/services/workspaceMetricsService");

    await expect(workspaceMetricsService.getWorkspaceMetrics()).rejects.toThrow("HTTP 500");
  });

  it("live mode throws when the body fails schema validation", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ not: "valid" }) }));
    const { workspaceMetricsService } = await import("../../src/services/workspaceMetricsService");

    await expect(workspaceMetricsService.getWorkspaceMetrics()).rejects.toThrow();
  });
});
