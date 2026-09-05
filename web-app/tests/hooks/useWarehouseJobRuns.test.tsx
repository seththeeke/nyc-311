import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useWarehouseJobRuns } from "../../src/hooks/useWarehouseJobRuns";
import { warehouseDataService } from "../../src/services/warehouseDataService";
import type { WarehouseJobRunListResponse } from "../../src/models/warehouseJobRun";

vi.mock("../../src/services/warehouseDataService", () => ({
  warehouseDataService: { getSchema: vi.fn(), getJobRuns: vi.fn() },
}));

const mockedGetJobRuns = vi.mocked(warehouseDataService.getJobRuns);

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockedGetJobRuns.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useWarehouseJobRuns", () => {
  it("resolves with the service's job runs", async () => {
    const response: WarehouseJobRunListResponse = { jobRuns: [] };
    mockedGetJobRuns.mockResolvedValue(response);

    const { result } = renderHook(() => useWarehouseJobRuns(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(response);
  });

  it("surfaces a service failure as an error state", async () => {
    mockedGetJobRuns.mockRejectedValue(new Error("Failed to fetch warehouse job runs: HTTP 500"));

    const { result } = renderHook(() => useWarehouseJobRuns(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Failed to fetch warehouse job runs: HTTP 500");
  });
});
