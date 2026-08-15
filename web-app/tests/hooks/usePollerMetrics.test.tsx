import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePollerMetrics } from "../../src/hooks/usePollerMetrics";
import { pollerMetricsService } from "../../src/services/pollerMetricsService";
import type { PollerMetrics } from "../../src/models/pollerMetrics";

vi.mock("../../src/services/pollerMetricsService", () => ({
  pollerMetricsService: { listPollerMetrics: vi.fn() },
}));

const mockedListPollerMetrics = vi.mocked(pollerMetricsService.listPollerMetrics);

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockedListPollerMetrics.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("usePollerMetrics", () => {
  it("resolves with the service's metrics", async () => {
    const metrics: PollerMetrics[] = [
      {
        ran_at: "2026-08-15T00:00:00.000Z",
        success: true,
        records_ingested: 5,
        duplicates_skipped: 1,
        records_rejected: 0,
        error_message: null,
      },
    ];
    mockedListPollerMetrics.mockResolvedValue(metrics);

    const { result } = renderHook(() => usePollerMetrics(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(metrics);
  });

  it("surfaces a service failure as an error state", async () => {
    mockedListPollerMetrics.mockRejectedValue(new Error("Failed to fetch ingestion metrics: HTTP 500"));

    const { result } = renderHook(() => usePollerMetrics(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Failed to fetch ingestion metrics: HTTP 500");
  });
});
