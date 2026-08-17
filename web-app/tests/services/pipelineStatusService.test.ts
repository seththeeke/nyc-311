import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

const validResponse = {
  pipelineName: "Nyc311Pipeline",
  stages: [],
  executions: [],
};

describe("pipelineStatusService", () => {
  it("mock mode returns the baked test-data fixture", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { pipelineStatusService } = await import("../../src/services/pipelineStatusService");
    const { MOCK_PIPELINE_STATUS } = await import("../../src/test-data/pipelineStatus");

    await expect(pipelineStatusService.getPipelineStatus()).resolves.toEqual(MOCK_PIPELINE_STATUS);
  });

  it("live mode fetches from config.pipelineApiBaseUrl + /pipeline/status and parses the response", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_PIPELINE_API_BASE_URL", "https://pipeline-api.example.com");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => validResponse })
    );

    const { pipelineStatusService } = await import("../../src/services/pipelineStatusService");

    await expect(pipelineStatusService.getPipelineStatus()).resolves.toEqual(validResponse);
    expect(fetch).toHaveBeenCalledWith("https://pipeline-api.example.com/pipeline/status");
  });

  it("live mode throws a descriptive error when the response is not ok", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const { pipelineStatusService } = await import("../../src/services/pipelineStatusService");

    await expect(pipelineStatusService.getPipelineStatus()).rejects.toThrow("HTTP 500");
  });

  it("live mode throws when the response body fails schema validation", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ not: "valid" }) })
    );

    const { pipelineStatusService } = await import("../../src/services/pipelineStatusService");

    await expect(pipelineStatusService.getPipelineStatus()).rejects.toThrow();
  });
});
