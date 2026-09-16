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
  job_type: "SCHEDULED",
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
  it("calls the service with name/sql/cadence and returns the updated definition", async () => {
    mockedUpdateJob.mockResolvedValue(definition);

    const { result } = renderHook(() => useUpdateWarehouseJob(), { wrapper });

    await act(async () => {
      const updated = await result.current.updateJob("order_volume_by_zip", "SELECT 2", "cron(0 10 * * ? *)");
      expect(updated).toEqual(definition);
    });

    expect(mockedUpdateJob).toHaveBeenCalledWith("order_volume_by_zip", "SELECT 2", "cron(0 10 * * ? *)");
    expect(result.current.isUpdating).toBe(false);
  });

  it("calls the service with no cadenceCron when omitted (a saved query)", async () => {
    mockedUpdateJob.mockResolvedValue({ ...definition, job_type: "SAVED_QUERY", cadence_cron: undefined, schedule_name: undefined });

    const { result } = renderHook(() => useUpdateWarehouseJob(), { wrapper });

    await act(async () => {
      await result.current.updateJob("order_volume_by_zip", "SELECT 2");
    });

    expect(mockedUpdateJob).toHaveBeenCalledWith("order_volume_by_zip", "SELECT 2", undefined);
  });

  it("surfaces an updateJob failure via error", async () => {
    mockedUpdateJob.mockRejectedValue(new Error('No job named "x"'));

    const { result } = renderHook(() => useUpdateWarehouseJob(), { wrapper });

    await act(async () => {
      await expect(result.current.updateJob("x", "SELECT 2", "cron(0 10 * * ? *)")).rejects.toThrow(
        'No job named "x"'
      );
    });

    await waitFor(() => expect(result.current.error?.message).toBe('No job named "x"'));
  });
});
