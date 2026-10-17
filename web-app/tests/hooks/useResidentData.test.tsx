import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useResidentIdea } from "../../src/hooks/useResidentIdea";
import { useResidentIdeas } from "../../src/hooks/useResidentIdeas";
import { useResidentPersonas } from "../../src/hooks/useResidentPersonas";
import { residentService } from "../../src/services/residentService";
import { MOCK_RESIDENT_IDEAS } from "../../src/test-data/residentIdeas";
import { MOCK_RESIDENT_PERSONAS } from "../../src/test-data/residentPersonas";

vi.mock("../../src/services/residentService", () => ({
  residentService: { listPersonas: vi.fn(), listIdeas: vi.fn(), getPersona: vi.fn(), getIdea: vi.fn() },
}));
const mocked = vi.mocked(residentService);

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("useResidentPersonas", () => {
  it("unwraps the page into a list of personas", async () => {
    mocked.listPersonas.mockResolvedValue({ items: MOCK_RESIDENT_PERSONAS, nextCursor: null });
    const { result } = renderHook(() => useResidentPersonas(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(MOCK_RESIDENT_PERSONAS));
  });
});

describe("useResidentIdeas", () => {
  it("asks for everyone's ideas with no persona, and one persona's otherwise", async () => {
    mocked.listIdeas.mockResolvedValue({ items: MOCK_RESIDENT_IDEAS, nextCursor: null });
    const all = renderHook(() => useResidentIdeas(null), { wrapper });
    await waitFor(() => expect(all.result.current.data).toEqual(MOCK_RESIDENT_IDEAS));
    expect(mocked.listIdeas).toHaveBeenLastCalledWith({});

    renderHook(() => useResidentIdeas("juniper"), { wrapper });
    await waitFor(() => expect(mocked.listIdeas).toHaveBeenLastCalledWith({ personaId: "juniper" }));
  });

  it("surfaces a failure", async () => {
    mocked.listIdeas.mockRejectedValue(new Error("HTTP 404"));
    const { result } = renderHook(() => useResidentIdeas(null), { wrapper });
    await waitFor(() => expect(result.current.error?.message).toBe("HTTP 404"));
  });
});

describe("useResidentIdea", () => {
  it("asks for one idea by resident and id", async () => {
    mocked.getIdea.mockResolvedValue(MOCK_RESIDENT_IDEAS[0]);
    const { result } = renderHook(() => useResidentIdea("hawthorn", "01K7IDEA0014"), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(MOCK_RESIDENT_IDEAS[0]));
    expect(mocked.getIdea).toHaveBeenCalledWith("hawthorn", "01K7IDEA0014");
  });
});
