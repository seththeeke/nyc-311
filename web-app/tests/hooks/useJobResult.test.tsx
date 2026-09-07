import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useJobResult, jobResultQueryKey } from "../../src/hooks/useJobResult";
import { warehouseDataService } from "../../src/services/warehouseDataService";
import type { JobResult } from "../../src/models/jobResult";

vi.mock("../../src/services/warehouseDataService", () => ({
  warehouseDataService: { getSchema: vi.fn(), getJobRuns: vi.fn(), getJobResult: vi.fn() },
}));

const mockedGetJobResult = vi.mocked(warehouseDataService.getJobResult);

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockedGetJobResult.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const result: JobResult = {
  job_name: "order_volume_by_stage_7d",
  job_run_id: "01RUN",
  run_date: "2026-09-07",
  computed_at: "2026-09-07T14:16:36.410Z",
  columns: [],
  rows: [],
};

describe("useJobResult", () => {
  it("keys the query by job name", () => {
    expect(jobResultQueryKey("job_x")).toEqual(["jobResult", "job_x"]);
  });

  it("resolves with the service's job result for the given job name", async () => {
    mockedGetJobResult.mockResolvedValue(result);

    const { result: hook } = renderHook(() => useJobResult("order_volume_by_stage_7d"), { wrapper });

    await waitFor(() => expect(hook.current.isSuccess).toBe(true));
    expect(hook.current.data).toEqual(result);
    expect(mockedGetJobResult).toHaveBeenCalledWith("order_volume_by_stage_7d");
  });

  it("surfaces a service failure as an error state", async () => {
    mockedGetJobResult.mockRejectedValue(new Error("Failed to fetch result for 'x': HTTP 404"));

    const { result: hook } = renderHook(() => useJobResult("x"), { wrapper });

    await waitFor(() => expect(hook.current.isError).toBe(true));
    expect(hook.current.error?.message).toContain("HTTP 404");
  });
});
