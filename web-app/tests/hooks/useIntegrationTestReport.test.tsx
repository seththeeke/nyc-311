import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useIntegrationTestReport } from "../../src/hooks/useIntegrationTestReport";
import { integrationTestReportService } from "../../src/services/integrationTestReportService";
import type { IntegrationTestReport } from "../../src/models/integrationTestReport";

vi.mock("../../src/services/integrationTestReportService", () => ({
  integrationTestReportService: { getReport: vi.fn() },
}));

const mockedGetReport = vi.mocked(integrationTestReportService.getReport);

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockedGetReport.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useIntegrationTestReport", () => {
  it("resolves with the service's report", async () => {
    const report: IntegrationTestReport = {
      target: "test",
      ranAt: "2026-08-24T12:00:00.000Z",
      routes: { "/orders": { hit: true, statusCode: 200, ok: true } },
    };
    mockedGetReport.mockResolvedValue(report);

    const { result } = renderHook(() => useIntegrationTestReport(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(report);
  });

  it("surfaces a service failure as an error state", async () => {
    mockedGetReport.mockRejectedValue(new Error("Failed to fetch integration-test report: HTTP 404"));

    const { result } = renderHook(() => useIntegrationTestReport(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Failed to fetch integration-test report: HTTP 404");
  });
});
