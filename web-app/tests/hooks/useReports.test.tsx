import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useReports } from "../../src/hooks/useReports";
import { reportsService } from "../../src/services/reportsService";
import type { ReportsResponse } from "../../src/models/report";

vi.mock("../../src/services/reportsService", () => ({
  reportsService: { getReports: vi.fn() },
}));

const mockedGetReports = vi.mocked(reportsService.getReports);

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockedGetReports.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useReports", () => {
  it("resolves with the service's reports response", async () => {
    const response: ReportsResponse = {
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
    mockedGetReports.mockResolvedValue(response);

    const { result } = renderHook(() => useReports(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(response);
  });

  it("surfaces a service failure as an error state", async () => {
    mockedGetReports.mockRejectedValue(new Error("Failed to fetch reports: HTTP 503"));

    const { result } = renderHook(() => useReports(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Failed to fetch reports: HTTP 503");
  });
});
