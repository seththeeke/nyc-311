import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useOrders } from "../../src/hooks/useOrders";
import { orderService } from "../../src/services/orderService";
import type { OrderListResponse } from "../../src/models/order";

vi.mock("../../src/services/orderService", () => ({
  orderService: { listOrders: vi.fn() },
}));

const mockedListOrders = vi.mocked(orderService.listOrders);

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockedListOrders.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useOrders", () => {
  it("resolves with the service's page and passes params through", async () => {
    const response: OrderListResponse = { orders: [], nextCursor: null };
    mockedListOrders.mockResolvedValue(response);

    const { result } = renderHook(() => useOrders({ limit: 10, stage: "INGEST" }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(response);
    expect(mockedListOrders).toHaveBeenCalledWith({ limit: 10, stage: "INGEST" });
  });

  it("surfaces a service failure as an error state", async () => {
    mockedListOrders.mockRejectedValue(new Error("Failed to fetch orders: HTTP 500"));

    const { result } = renderHook(() => useOrders({}), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Failed to fetch orders: HTTP 500");
  });
});
