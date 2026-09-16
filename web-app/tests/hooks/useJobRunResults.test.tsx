import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useJobRunResults } from "../../src/hooks/useJobRunResults";
import { warehouseJobRunResultsService } from "../../src/services/warehouseJobRunResultsService";
import type { JobRunResultItem } from "../../src/models/jobRunResults";

vi.mock("../../src/services/warehouseJobRunResultsService", () => ({
  warehouseJobRunResultsService: { getJobRunResults: vi.fn() },
}));

const mockedGetJobRunResults = vi.mocked(warehouseJobRunResultsService.getJobRunResults);

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockedGetJobRunResults.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useJobRunResults", () => {
  it("starts idle — not loading, no error, no results", () => {
    const { result } = renderHook(() => useJobRunResults(), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.results).toEqual([]);
  });

  it("calls the service with the job_run_ids and returns/exposes the results", async () => {
    const items: JobRunResultItem[] = [
      {
        job_run_id: "01A",
        result: {
          job_name: "order_volume_by_stage_7d",
          job_run_id: "01A",
          run_date: "2026-09-04",
          computed_at: "2026-09-04T09:00:14.000Z",
          columns: [{ name: "stage", type: "varchar" }],
          rows: [{ stage: "SCHEDULE" }],
        },
        error: null,
      },
    ];
    mockedGetJobRunResults.mockResolvedValue(items);

    const { result } = renderHook(() => useJobRunResults(), { wrapper });

    await act(async () => {
      const returned = await result.current.loadResults(["01A"]);
      expect(returned).toEqual(items);
    });

    expect(mockedGetJobRunResults).toHaveBeenCalledWith(["01A"]);
    await waitFor(() => expect(result.current.results).toEqual(items));
    expect(result.current.isLoading).toBe(false);
  });

  it("surfaces a getJobRunResults failure via error", async () => {
    mockedGetJobRunResults.mockRejectedValue(new Error("Failed to load job run results: HTTP 500"));

    const { result } = renderHook(() => useJobRunResults(), { wrapper });

    await act(async () => {
      await expect(result.current.loadResults(["01A"])).rejects.toThrow("Failed to load job run results: HTTP 500");
    });

    await waitFor(() => expect(result.current.error?.message).toBe("Failed to load job run results: HTTP 500"));
  });
});
