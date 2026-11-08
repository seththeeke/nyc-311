import { afterEach, describe, expect, it, vi } from "vitest";
import { MOCK_CODE_QUALITY_REPORTS } from "../../src/test-data/codeQualityReports";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

const [newest] = MOCK_CODE_QUALITY_REPORTS;
const summary = { date: newest.date, time: newest.time, package: newest.package, score: newest.score, previous: newest.previous };

describe("codeQualityReportService", () => {
  it("mock mode lists the baked reports without their text and finds one by run", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { codeQualityReportService } = await import("../../src/services/codeQualityReportService");
    const reports = await codeQualityReportService.listReports();
    expect(reports[0]).toEqual(summary);
    expect(reports).toHaveLength(MOCK_CODE_QUALITY_REPORTS.length);
    await expect(codeQualityReportService.getReport(newest.date, newest.time)).resolves.toEqual(newest);
    await expect(codeQualityReportService.getReport("2000-01-01", "00_00")).rejects.toThrow("No code quality report");
  });

  it("live mode reads both routes from the web-app's API and parses them", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ reports: [summary] }) }).mockResolvedValueOnce({ ok: true, json: async () => newest })
    );
    const { codeQualityReportService } = await import("../../src/services/codeQualityReportService");
    await expect(codeQualityReportService.listReports()).resolves.toEqual([summary]);
    await expect(codeQualityReportService.getReport(newest.date, newest.time)).resolves.toEqual(newest);
    expect(fetch).toHaveBeenNthCalledWith(1, "https://api.example.com/monitoring/code-quality/reports");
    expect(fetch).toHaveBeenNthCalledWith(2, `https://api.example.com/monitoring/code-quality/reports/${newest.date}/${newest.time}`);
  });

  it("live mode throws on a failed response", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const { codeQualityReportService } = await import("../../src/services/codeQualityReportService");
    await expect(codeQualityReportService.listReports()).rejects.toThrow("HTTP 404");
    await expect(codeQualityReportService.getReport("2026-11-09", "23_30")).rejects.toThrow("HTTP 404");
  });
});
