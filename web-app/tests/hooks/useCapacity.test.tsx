import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCapacity } from "../../src/hooks/useCapacity";
import { capacityService } from "../../src/services/capacityService";
import type { CapacityStatus, Operator } from "../../src/models/operator";

vi.mock("../../src/services/capacityService", () => ({
  capacityService: { getCapacityStatus: vi.fn(), addCapacity: vi.fn(), removeCapacity: vi.fn() },
}));

const mockedGetCapacityStatus = vi.mocked(capacityService.getCapacityStatus);
const mockedAddCapacity = vi.mocked(capacityService.addCapacity);
const mockedRemoveCapacity = vi.mocked(capacityService.removeCapacity);

const operator: Operator = {
  operator_id: "01OPERATOR",
  status: "ACTIVE",
  current_activity: "IDLE",
  removal_requested_at: null,
  start_datetime: "2026-09-12T00:00:00.000Z",
  end_datetime: null,
  rate_per_hour: 45,
  last_event_sequence: 0,
};

const status: CapacityStatus = { available_count: 1, fleet_size: 1, hourly_burn_rate: 45, roster: [operator] };

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchInterval: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockedGetCapacityStatus.mockReset();
  mockedAddCapacity.mockReset();
  mockedRemoveCapacity.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useCapacity", () => {
  it("resolves status from the service", async () => {
    mockedGetCapacityStatus.mockResolvedValue(status);

    const { result } = renderHook(() => useCapacity(), { wrapper });

    await waitFor(() => expect(result.current.status).toEqual(status));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("surfaces a getCapacityStatus failure as an error state", async () => {
    mockedGetCapacityStatus.mockRejectedValue(new Error("HTTP 500"));

    const { result } = renderHook(() => useCapacity(), { wrapper });

    await waitFor(() => expect(result.current.error?.message).toBe("HTTP 500"));
  });

  it("addCapacity calls the service and refetches status", async () => {
    mockedGetCapacityStatus.mockResolvedValue(status);
    mockedAddCapacity.mockResolvedValue(operator);

    const { result } = renderHook(() => useCapacity(), { wrapper });
    await waitFor(() => expect(result.current.status).toEqual(status));

    await act(async () => {
      await result.current.addCapacity(60);
    });

    expect(mockedAddCapacity).toHaveBeenCalledWith(60);
    expect(mockedGetCapacityStatus).toHaveBeenCalledTimes(2);
  });

  it("surfaces an addCapacity failure via addError", async () => {
    mockedGetCapacityStatus.mockResolvedValue(status);
    mockedAddCapacity.mockRejectedValue(new Error("bad rate"));

    const { result } = renderHook(() => useCapacity(), { wrapper });
    await waitFor(() => expect(result.current.status).toEqual(status));

    await act(async () => {
      await expect(result.current.addCapacity()).rejects.toThrow();
    });

    await waitFor(() => expect(result.current.addError?.message).toBe("bad rate"));
  });

  it("removeCapacity calls the service and refetches status", async () => {
    mockedGetCapacityStatus.mockResolvedValue(status);
    mockedRemoveCapacity.mockResolvedValue({ ...operator, status: "INACTIVE" });

    const { result } = renderHook(() => useCapacity(), { wrapper });
    await waitFor(() => expect(result.current.status).toEqual(status));

    await act(async () => {
      await result.current.removeCapacity("01OPERATOR");
    });

    expect(mockedRemoveCapacity).toHaveBeenCalledWith("01OPERATOR");
    expect(mockedGetCapacityStatus).toHaveBeenCalledTimes(2);
  });

  it("surfaces a removeCapacity failure via removeError", async () => {
    mockedGetCapacityStatus.mockResolvedValue(status);
    mockedRemoveCapacity.mockRejectedValue(new Error("not found"));

    const { result } = renderHook(() => useCapacity(), { wrapper });
    await waitFor(() => expect(result.current.status).toEqual(status));

    await act(async () => {
      await expect(result.current.removeCapacity("01MISSING")).rejects.toThrow();
    });

    await waitFor(() => expect(result.current.removeError?.message).toBe("not found"));
  });
});
