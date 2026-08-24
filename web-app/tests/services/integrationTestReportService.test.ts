import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("integrationTestReportService", () => {
  it("mock mode returns the baked test-data fixture", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { integrationTestReportService } = await import("../../src/services/integrationTestReportService");
    const { MOCK_INTEGRATION_TEST_REPORT } = await import("../../src/test-data/integrationTestReport");

    await expect(integrationTestReportService.getReport()).resolves.toEqual(MOCK_INTEGRATION_TEST_REPORT);
  });

  it("live mode fetches the same-origin static report and parses the response", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    const report = { target: "test", ranAt: "2026-08-24T12:00:00.000Z", routes: {} };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => report }));

    const { integrationTestReportService } = await import("../../src/services/integrationTestReportService");

    await expect(integrationTestReportService.getReport()).resolves.toEqual(report);
    expect(fetch).toHaveBeenCalledWith("/integration-tests/route-report.json");
  });

  it("live mode throws a descriptive error when the response is not ok", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    const { integrationTestReportService } = await import("../../src/services/integrationTestReportService");

    await expect(integrationTestReportService.getReport()).rejects.toThrow("HTTP 404");
  });

  it("live mode throws when the response body fails schema validation", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ not: "valid" }) }));

    const { integrationTestReportService } = await import("../../src/services/integrationTestReportService");

    await expect(integrationTestReportService.getReport()).rejects.toThrow();
  });
});
