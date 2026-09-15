import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUpdateWarehouseJob } from "../../src/hooks/useUpdateWarehouseJob";
import { warehouseJobDefinitionService } from "../../src/services/warehouseJobDefinitionService";
import type { WarehouseJobDefinition } from "../../src/models/warehouseJobDefinition";

vi.mock("../../src/services/warehouseJobDefinitionService", () => ({
  warehouseJobDefinitionService: { listJobs: vi.fn(), updateJob: vi.fn() },
}));

const mockedUpdateJob = vi.mocked(warehouseJobDefinitionService.updateJob);

const definition: WarehouseJobDefinition = {
  job_run_id: "DEF#order_volume_by_zip",
  record_type: "DEFINITION",
  job_name: "order_volume_by_zip",
  sql_s3_key: "job-definitions/order_volume_by_zip.sql",
  cadence_cron: "cron(0 10 * * ? *)",
  schedule_name: "Nyc311WarehouseJob-order_volume_by_zip-Test",
  created_at: "2026-09-13T00:00:00.000Z",
  created_by: "01ADMIN",
};

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockedUpdateJob.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useUpdateWarehouseJob", () => {
  it("calls the service with name/cadence/sql and returns the updated definition", async () => {
    mockedUpdateJob.mockResolvedValue(definition);

    const { result } = renderHook(() => useUpdateWarehouseJob(), { wrapper });

    await act(async () => {
      const updated = await result.current.updateJob("order_volume_by_zip", "cron(0 10 * * ? *)", "SELECT 2");
      expect(updated).toEqual(definition);
    });

    expect(mockedUpdateJob).toHaveBeenCalledWith("order_volume_by_zip", "cron(0 10 * * ? *)", "SELECT 2");
    expect(result.current.isUpdating).toBe(false);
  });

  it("surfaces an updateJob failure via error", async () => {
    mockedUpdateJob.mockRejectedValue(new Error('No job named "x"'));

    const { result } = renderHook(() => useUpdateWarehouseJob(), { wrapper });

    await act(async () => {
      await expect(result.current.updateJob("x", "cron(0 10 * * ? *)", "SELECT 2")).rejects.toThrow(
        'No job named "x"'
      );
    });

    await waitFor(() => expect(result.current.error?.message).toBe('No job named "x"'));
  });
});
