import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCustomerIdeas } from "../../src/hooks/useCustomerIdeas";
import { useCustomerPersonas } from "../../src/hooks/useCustomerPersonas";
import { customerService } from "../../src/services/customerService";
import { MOCK_CUSTOMER_IDEAS } from "../../src/test-data/customerIdeas";
import { MOCK_CUSTOMER_PERSONAS } from "../../src/test-data/customerPersonas";

vi.mock("../../src/services/customerService", () => ({
  customerService: { listPersonas: vi.fn(), listIdeas: vi.fn(), getPersona: vi.fn() },
}));
const mocked = vi.mocked(customerService);

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("useCustomerPersonas", () => {
  it("unwraps the page into a list of personas", async () => {
    mocked.listPersonas.mockResolvedValue({ items: MOCK_CUSTOMER_PERSONAS, nextCursor: null });
    const { result } = renderHook(() => useCustomerPersonas(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(MOCK_CUSTOMER_PERSONAS));
  });
});

describe("useCustomerIdeas", () => {
  it("asks for everyone's ideas with no persona, and one persona's otherwise", async () => {
    mocked.listIdeas.mockResolvedValue({ items: MOCK_CUSTOMER_IDEAS, nextCursor: null });
    const all = renderHook(() => useCustomerIdeas(null), { wrapper });
    await waitFor(() => expect(all.result.current.data).toEqual(MOCK_CUSTOMER_IDEAS));
    expect(mocked.listIdeas).toHaveBeenLastCalledWith({});

    renderHook(() => useCustomerIdeas("juniper"), { wrapper });
    await waitFor(() => expect(mocked.listIdeas).toHaveBeenLastCalledWith({ personaId: "juniper" }));
  });

  it("surfaces a failure", async () => {
    mocked.listIdeas.mockRejectedValue(new Error("HTTP 404"));
    const { result } = renderHook(() => useCustomerIdeas(null), { wrapper });
    await waitFor(() => expect(result.current.error?.message).toBe("HTTP 404"));
  });
});
