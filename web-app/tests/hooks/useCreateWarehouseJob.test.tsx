import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCreateWarehouseJob } from "../../src/hooks/useCreateWarehouseJob";
import { warehouseJobDefinitionService } from "../../src/services/warehouseJobDefinitionService";
import type { WarehouseJobDefinition } from "../../src/models/warehouseJobDefinition";

vi.mock("../../src/services/warehouseJobDefinitionService", () => ({
  warehouseJobDefinitionService: { listJobs: vi.fn(), createJob: vi.fn(), deleteJob: vi.fn() },
}));

const mockedCreateJob = vi.mocked(warehouseJobDefinitionService.createJob);

const job: WarehouseJobDefinition = {
  job_run_id: "DEF#order_volume_by_zip",
  record_type: "DEFINITION",
  job_name: "order_volume_by_zip",
  sql_s3_key: "job-definitions/order_volume_by_zip.sql",
  cadence_cron: "cron(0 9 * * ? *)",
  schedule_name: "Nyc311WarehouseJob-order_volume_by_zip-Test",
  created_at: "2026-09-13T19:04:11.000Z",
  created_by: "01ADMIN0000000000000000001",
};

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockedCreateJob.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useCreateWarehouseJob", () => {
  it("calls the service with name/cadence/sql and resolves the created definition", async () => {
    mockedCreateJob.mockResolvedValue(job);

    const { result } = renderHook(() => useCreateWarehouseJob(), { wrapper });

    await act(async () => {
      const created = await result.current.createJob("order_volume_by_zip", "cron(0 9 * * ? *)", "SELECT 1");
      expect(created).toEqual(job);
    });

    expect(mockedCreateJob).toHaveBeenCalledWith("order_volume_by_zip", "cron(0 9 * * ? *)", "SELECT 1");
    expect(result.current.isCreating).toBe(false);
  });

  it("surfaces a createJob failure via error", async () => {
    mockedCreateJob.mockRejectedValue(new Error("already exists"));

    const { result } = renderHook(() => useCreateWarehouseJob(), { wrapper });

    await act(async () => {
      await expect(result.current.createJob("order_volume_by_zip", "cron(0 9 * * ? *)", "SELECT 1")).rejects.toThrow(
        "already exists"
      );
    });

    await waitFor(() => expect(result.current.error?.message).toBe("already exists"));
  });
});
