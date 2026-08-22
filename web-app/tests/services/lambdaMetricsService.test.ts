import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("lambdaMetricsService", () => {
  it("mock mode returns the baked test-data fixtures", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { lambdaMetricsService } = await import("../../src/services/lambdaMetricsService");
    const { MOCK_LAMBDA_METRICS } = await import("../../src/test-data/lambdaMetrics");

    await expect(lambdaMetricsService.listLambdaHealth()).resolves.toEqual(MOCK_LAMBDA_METRICS);
  });

  it("live mode fetches from config.apiBaseUrl + /lambda-metrics and parses the response", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    const lambdas = [
      {
        logicalName: "Poller",
        functionName: "Nyc311Poller-Test",
        points: [{ date: "2026-08-21", invocations: 4, errors: 0, successes: 4 }],
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ lambdas }) })
    );

    const { lambdaMetricsService } = await import("../../src/services/lambdaMetricsService");

    await expect(lambdaMetricsService.listLambdaHealth()).resolves.toEqual(lambdas);
    expect(fetch).toHaveBeenCalledWith("https://api.example.com/lambda-metrics");
  });

  it("live mode throws a descriptive error when the response is not ok", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const { lambdaMetricsService } = await import("../../src/services/lambdaMetricsService");

    await expect(lambdaMetricsService.listLambdaHealth()).rejects.toThrow("HTTP 500");
  });

  it("live mode throws when the response body fails schema validation", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ not: "valid" }) })
    );

    const { lambdaMetricsService } = await import("../../src/services/lambdaMetricsService");

    await expect(lambdaMetricsService.listLambdaHealth()).rejects.toThrow();
  });
});
