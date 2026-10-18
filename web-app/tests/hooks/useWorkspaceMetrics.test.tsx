import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useWorkspaceMetrics, WORKSPACE_METRICS_REFETCH_INTERVAL_MS } from "../../src/hooks/useWorkspaceMetrics";
import { workspaceMetricsService } from "../../src/services/workspaceMetricsService";
import { MOCK_WORKSPACE_METRICS } from "../../src/test-data/workspaceMetrics";

vi.mock("../../src/services/workspaceMetricsService", () => ({
  workspaceMetricsService: { getWorkspaceMetrics: vi.fn() },
}));
const mockedGet = vi.mocked(workspaceMetricsService.getWorkspaceMetrics);

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockedGet.mockReset();
});

describe("useWorkspaceMetrics", () => {
  it("resolves with the service's workspace metrics", async () => {
    mockedGet.mockResolvedValue(MOCK_WORKSPACE_METRICS);
    const { result } = renderHook(() => useWorkspaceMetrics(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(MOCK_WORKSPACE_METRICS);
  });

  it("surfaces a service failure as an error", async () => {
    mockedGet.mockRejectedValue(new Error("HTTP 500"));
    const { result } = renderHook(() => useWorkspaceMetrics(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("HTTP 500");
  });
});

describe("WORKSPACE_METRICS_REFETCH_INTERVAL_MS", () => {
  it("polls at the fleet map's 15-second cadence", () => {
    expect(WORKSPACE_METRICS_REFETCH_INTERVAL_MS).toBe(15_000);
  });
});
