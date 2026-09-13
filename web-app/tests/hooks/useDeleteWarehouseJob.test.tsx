import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDeleteWarehouseJob } from "../../src/hooks/useDeleteWarehouseJob";
import { warehouseJobDefinitionService } from "../../src/services/warehouseJobDefinitionService";

vi.mock("../../src/services/warehouseJobDefinitionService", () => ({
  warehouseJobDefinitionService: { listJobs: vi.fn(), createJob: vi.fn(), deleteJob: vi.fn() },
}));

const mockedDeleteJob = vi.mocked(warehouseJobDefinitionService.deleteJob);

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockedDeleteJob.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useDeleteWarehouseJob", () => {
  it("calls the service with the job name", async () => {
    mockedDeleteJob.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteWarehouseJob(), { wrapper });

    await act(async () => {
      await result.current.deleteJob("order_volume_by_zip");
    });

    expect(mockedDeleteJob).toHaveBeenCalledWith("order_volume_by_zip");
    expect(result.current.isDeleting).toBe(false);
  });

  it("surfaces a deleteJob failure via error", async () => {
    mockedDeleteJob.mockRejectedValue(new Error("No job named \"x\""));

    const { result } = renderHook(() => useDeleteWarehouseJob(), { wrapper });

    await act(async () => {
      await expect(result.current.deleteJob("x")).rejects.toThrow('No job named "x"');
    });

    await waitFor(() => expect(result.current.error?.message).toBe('No job named "x"'));
  });
});
