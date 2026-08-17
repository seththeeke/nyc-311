import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePipelineStatus } from "../../src/hooks/usePipelineStatus";
import { pipelineStatusService } from "../../src/services/pipelineStatusService";
import type { PipelineStatusResponse } from "../../src/models/pipelineStatus";

vi.mock("../../src/services/pipelineStatusService", () => ({
  pipelineStatusService: { getPipelineStatus: vi.fn() },
}));

const mockedGetPipelineStatus = vi.mocked(pipelineStatusService.getPipelineStatus);

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockedGetPipelineStatus.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("usePipelineStatus", () => {
  it("resolves with the service's status", async () => {
    const status: PipelineStatusResponse = { pipelineName: "Nyc311Pipeline", stages: [], executions: [] };
    mockedGetPipelineStatus.mockResolvedValue(status);

    const { result } = renderHook(() => usePipelineStatus(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(status);
  });

  it("surfaces a service failure as an error state", async () => {
    mockedGetPipelineStatus.mockRejectedValue(new Error("Failed to fetch pipeline status: HTTP 500"));

    const { result } = renderHook(() => usePipelineStatus(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Failed to fetch pipeline status: HTTP 500");
  });
});
