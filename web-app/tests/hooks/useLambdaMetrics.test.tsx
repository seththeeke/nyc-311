import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLambdaMetrics } from "../../src/hooks/useLambdaMetrics";
import { lambdaMetricsService } from "../../src/services/lambdaMetricsService";
import type { LambdaHealth } from "../../src/models/lambdaMetrics";

vi.mock("../../src/services/lambdaMetricsService", () => ({
  lambdaMetricsService: { listLambdaHealth: vi.fn() },
}));

const mockedListLambdaHealth = vi.mocked(lambdaMetricsService.listLambdaHealth);

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockedListLambdaHealth.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useLambdaMetrics", () => {
  it("resolves with the service's Lambda health list", async () => {
    const lambdas: LambdaHealth[] = [
      {
        logicalName: "Poller",
        functionName: "Nyc311Poller-Test",
        points: [{ date: "2026-08-21", invocations: 4, errors: 0, successes: 4 }],
      },
    ];
    mockedListLambdaHealth.mockResolvedValue(lambdas);

    const { result } = renderHook(() => useLambdaMetrics(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(lambdas);
  });

  it("surfaces a service failure as an error state", async () => {
    mockedListLambdaHealth.mockRejectedValue(new Error("Failed to fetch Lambda metrics: HTTP 500"));

    const { result } = renderHook(() => useLambdaMetrics(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Failed to fetch Lambda metrics: HTTP 500");
  });
});
