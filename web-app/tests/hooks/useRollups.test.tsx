import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRollups } from "../../src/hooks/useRollups";
import { warehouseDataService } from "../../src/services/warehouseDataService";
import type { AnalyticsRollupListResponse } from "../../src/models/analyticsRollup";

vi.mock("../../src/services/warehouseDataService", () => ({
  warehouseDataService: { getSchema: vi.fn(), getJobRuns: vi.fn(), getRollups: vi.fn() },
}));

const mockedGetRollups = vi.mocked(warehouseDataService.getRollups);

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockedGetRollups.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useRollups", () => {
  it("resolves with the service's rollups", async () => {
    const response: AnalyticsRollupListResponse = { rollups: [] };
    mockedGetRollups.mockResolvedValue(response);

    const { result } = renderHook(() => useRollups(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(response);
  });

  it("surfaces a service failure as an error state", async () => {
    mockedGetRollups.mockRejectedValue(new Error("Failed to fetch analytics rollups: HTTP 500"));

    const { result } = renderHook(() => useRollups(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Failed to fetch analytics rollups: HTTP 500");
  });
});
