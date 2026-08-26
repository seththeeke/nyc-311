import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useOrderEvents } from "../../src/hooks/useOrderEvents";
import { orderEventService } from "../../src/services/orderEventService";
import type { OrderEventListResponse } from "../../src/models/order";

vi.mock("../../src/services/orderEventService", () => ({
  orderEventService: { listOrderEvents: vi.fn() },
}));

const mockedListOrderEvents = vi.mocked(orderEventService.listOrderEvents);

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockedListOrderEvents.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useOrderEvents", () => {
  it("resolves with the service's page and passes params through", async () => {
    const response: OrderEventListResponse = { events: [], nextCursor: null };
    mockedListOrderEvents.mockResolvedValue(response);

    const { result } = renderHook(() => useOrderEvents({ limit: 10, event_type: "ORDER_CREATED" }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(response);
    expect(mockedListOrderEvents).toHaveBeenCalledWith({ limit: 10, event_type: "ORDER_CREATED" });
  });

  it("surfaces a service failure as an error state", async () => {
    mockedListOrderEvents.mockRejectedValue(new Error("Failed to fetch order events: HTTP 500"));

    const { result } = renderHook(() => useOrderEvents({}), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Failed to fetch order events: HTTP 500");
  });
});
