import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useWarehouseQuery } from "../../src/hooks/useWarehouseQuery";
import { warehouseQueryService } from "../../src/services/warehouseQueryService";
import type { AdHocQueryResult } from "../../src/models/adHocQueryResult";

vi.mock("../../src/services/warehouseQueryService", () => ({
  warehouseQueryService: { runQuery: vi.fn() },
}));

const mockedRunQuery = vi.mocked(warehouseQueryService.runQuery);

const result: AdHocQueryResult = {
  columns: [{ name: "n", type: "bigint" }],
  rows: [{ n: "1" }],
  row_count: 1,
  truncated: false,
  data_scanned_bytes: 10,
  engine_execution_time_ms: 5,
};

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockedRunQuery.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useWarehouseQuery", () => {
  it("starts idle — not running, no error, no result", () => {
    const { result: hookResult } = renderHook(() => useWarehouseQuery(), { wrapper });

    expect(hookResult.current.isRunning).toBe(false);
    expect(hookResult.current.error).toBeNull();
    expect(hookResult.current.result).toBeUndefined();
  });

  it("calls the service and surfaces the resultset", async () => {
    mockedRunQuery.mockResolvedValue(result);
    const { result: hookResult } = renderHook(() => useWarehouseQuery(), { wrapper });

    await act(async () => {
      await hookResult.current.runQuery("SELECT 1");
    });

    expect(mockedRunQuery).toHaveBeenCalledWith("SELECT 1");
    await waitFor(() => expect(hookResult.current.result).toEqual(result));
  });

  it("surfaces a failure via error", async () => {
    mockedRunQuery.mockRejectedValue(new Error("Only SELECT/WITH/SHOW/DESCRIBE/EXPLAIN statements are allowed"));
    const { result: hookResult } = renderHook(() => useWarehouseQuery(), { wrapper });

    await act(async () => {
      await expect(hookResult.current.runQuery("DELETE FROM x")).rejects.toThrow();
    });

    await waitFor(() =>
      expect(hookResult.current.error?.message).toBe("Only SELECT/WITH/SHOW/DESCRIBE/EXPLAIN statements are allowed")
    );
  });
});
