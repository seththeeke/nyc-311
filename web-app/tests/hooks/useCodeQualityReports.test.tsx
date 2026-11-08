import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCodeQualityReport, useCodeQualityReports } from "../../src/hooks/useCodeQualityReports";
import { codeQualityReportService } from "../../src/services/codeQualityReportService";
import { MOCK_CODE_QUALITY_REPORTS } from "../../src/test-data/codeQualityReports";

vi.mock("../../src/services/codeQualityReportService", () => ({ codeQualityReportService: { listReports: vi.fn(), getReport: vi.fn() } }));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.mocked(codeQualityReportService.listReports).mockReset();
  vi.mocked(codeQualityReportService.getReport).mockReset();
});

describe("code quality hooks", () => {
  it("useCodeQualityReports resolves with the service's list", async () => {
    vi.mocked(codeQualityReportService.listReports).mockResolvedValue(MOCK_CODE_QUALITY_REPORTS);
    const { result } = renderHook(() => useCodeQualityReports(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(MOCK_CODE_QUALITY_REPORTS);
  });

  it("useCodeQualityReport fetches a chosen report and idles without one", async () => {
    vi.mocked(codeQualityReportService.getReport).mockResolvedValue(MOCK_CODE_QUALITY_REPORTS[0]);
    const { result } = renderHook(() => useCodeQualityReport("2026-11-09", "23_30"), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(MOCK_CODE_QUALITY_REPORTS[0]));
    expect(codeQualityReportService.getReport).toHaveBeenCalledWith("2026-11-09", "23_30");
    const idle = renderHook(() => useCodeQualityReport(undefined, undefined), { wrapper });
    expect(idle.result.current.fetchStatus).toBe("idle");
    expect(codeQualityReportService.getReport).toHaveBeenCalledTimes(1);
  });
});
