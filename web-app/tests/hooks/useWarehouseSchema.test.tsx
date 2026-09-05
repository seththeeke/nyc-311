import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useWarehouseSchema } from "../../src/hooks/useWarehouseSchema";
import { warehouseDataService } from "../../src/services/warehouseDataService";
import type { WarehouseSchemaResponse } from "../../src/models/warehouseSchema";

vi.mock("../../src/services/warehouseDataService", () => ({
  warehouseDataService: { getSchema: vi.fn(), getJobRuns: vi.fn() },
}));

const mockedGetSchema = vi.mocked(warehouseDataService.getSchema);

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockedGetSchema.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useWarehouseSchema", () => {
  it("resolves with the service's schema", async () => {
    const schema: WarehouseSchemaResponse = { tables: [{ table_name: "order_events", columns: [] }] };
    mockedGetSchema.mockResolvedValue(schema);

    const { result } = renderHook(() => useWarehouseSchema(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(schema);
  });

  it("surfaces a service failure as an error state", async () => {
    mockedGetSchema.mockRejectedValue(new Error("Failed to fetch warehouse schema: HTTP 500"));

    const { result } = renderHook(() => useWarehouseSchema(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Failed to fetch warehouse schema: HTTP 500");
  });
});
