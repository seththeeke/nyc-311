import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useJobSql } from "../../src/hooks/useJobSql";
import { warehouseJobDefinitionService } from "../../src/services/warehouseJobDefinitionService";

vi.mock("../../src/services/warehouseJobDefinitionService", () => ({
  warehouseJobDefinitionService: { getJobSql: vi.fn() },
}));

const mockedGetJobSql = vi.mocked(warehouseJobDefinitionService.getJobSql);

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockedGetJobSql.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useJobSql", () => {
  it("starts idle — not loading, no error", () => {
    const { result } = renderHook(() => useJobSql(), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("calls the service with the job name and returns the sql text", async () => {
    mockedGetJobSql.mockResolvedValue("SELECT 1");

    const { result } = renderHook(() => useJobSql(), { wrapper });

    await act(async () => {
      const sql = await result.current.loadSql("order_volume_by_zip");
      expect(sql).toBe("SELECT 1");
    });

    expect(mockedGetJobSql).toHaveBeenCalledWith("order_volume_by_zip");
    expect(result.current.isLoading).toBe(false);
  });

  it("surfaces a getJobSql failure via error", async () => {
    mockedGetJobSql.mockRejectedValue(new Error('No job named "x"'));

    const { result } = renderHook(() => useJobSql(), { wrapper });

    await act(async () => {
      await expect(result.current.loadSql("x")).rejects.toThrow('No job named "x"');
    });

    await waitFor(() => expect(result.current.error?.message).toBe('No job named "x"'));
  });
});
