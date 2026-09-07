import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

const validResponse = {
  reports: [
    {
      job_name: "order_volume_by_stage_8w",
      title: "Order volume by stage — 8-week trend",
      run_date: "2026-09-04",
      computed_at: "2026-09-04T09:00:14.000Z",
      week_column: "week_start",
      series_column: "stage",
      value_column: "order_count",
      series: ["SCHEDULE"],
      weeks: [{ week: "2026-07-13", values: { SCHEDULE: 30 } }],
    },
  ],
};

describe("reportsService", () => {
  it("mock mode returns the baked test-data fixture", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { reportsService } = await import("../../src/services/reportsService");
    const { MOCK_REPORTS } = await import("../../src/test-data/reports");

    await expect(reportsService.getReports()).resolves.toEqual(MOCK_REPORTS);
  });

  it("live mode fetches /reports off the API base URL and parses the response", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => validResponse }));

    const { reportsService } = await import("../../src/services/reportsService");

    await expect(reportsService.getReports()).resolves.toEqual(validResponse);
    expect(fetch).toHaveBeenCalledWith("https://api.example.test/reports");
  });

  it("live mode throws a descriptive error when the response is not ok", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const { reportsService } = await import("../../src/services/reportsService");

    await expect(reportsService.getReports()).rejects.toThrow("HTTP 503");
  });

  it("live mode throws when the response body fails schema validation", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ not: "valid" }) }));

    const { reportsService } = await import("../../src/services/reportsService");

    await expect(reportsService.getReports()).rejects.toThrow();
  });
});
