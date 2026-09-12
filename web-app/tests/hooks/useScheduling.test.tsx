import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useScheduling } from "../../src/hooks/useScheduling";
import { schedulingService } from "../../src/services/schedulingService";

vi.mock("../../src/services/schedulingService", () => ({
  schedulingService: { runScheduling: vi.fn() },
}));

const mockedRunScheduling = vi.mocked(schedulingService.runScheduling);

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockedRunScheduling.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useScheduling", () => {
  it("starts idle — not running, no error, not yet succeeded", () => {
    const { result } = renderHook(() => useScheduling(), { wrapper });

    expect(result.current.isRunning).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.isSuccess).toBe(false);
  });

  it("calls the service and reports success", async () => {
    mockedRunScheduling.mockResolvedValue(undefined);
    const { result } = renderHook(() => useScheduling(), { wrapper });

    await act(async () => {
      await result.current.runScheduling();
    });

    expect(mockedRunScheduling).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("surfaces a failure via error", async () => {
    mockedRunScheduling.mockRejectedValue(new Error("HTTP 500"));
    const { result } = renderHook(() => useScheduling(), { wrapper });

    await act(async () => {
      await expect(result.current.runScheduling()).rejects.toThrow();
    });

    await waitFor(() => expect(result.current.error?.message).toBe("HTTP 500"));
  });
});
