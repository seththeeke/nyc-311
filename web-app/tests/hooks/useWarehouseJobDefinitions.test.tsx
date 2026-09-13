import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useWarehouseJobDefinitions } from "../../src/hooks/useWarehouseJobDefinitions";
import { warehouseJobDefinitionService } from "../../src/services/warehouseJobDefinitionService";
import type { WarehouseJobDefinition } from "../../src/models/warehouseJobDefinition";

vi.mock("../../src/services/warehouseJobDefinitionService", () => ({
  warehouseJobDefinitionService: { listJobs: vi.fn(), createJob: vi.fn(), deleteJob: vi.fn() },
}));

const mockedListJobs = vi.mocked(warehouseJobDefinitionService.listJobs);

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
  mockedListJobs.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useWarehouseJobDefinitions", () => {
  it("resolves the job list from the service", async () => {
    mockedListJobs.mockResolvedValue([job]);

    const { result } = renderHook(() => useWarehouseJobDefinitions(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([job]));
  });

  it("surfaces a listJobs failure as an error state", async () => {
    mockedListJobs.mockRejectedValue(new Error("HTTP 500"));

    const { result } = renderHook(() => useWarehouseJobDefinitions(), { wrapper });

    await waitFor(() => expect(result.current.error?.message).toBe("HTTP 500"));
  });
});
