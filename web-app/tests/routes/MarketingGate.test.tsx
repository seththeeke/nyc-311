import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MarketingGate } from "../../src/routes/MarketingGate";
import { clearMarketingEntry, MARKETING_ENTERED_AT_KEY, MARKETING_ENTERED_KEY } from "../../src/routes/marketingEntry";
import { useFeatureTreatment } from "../../src/hooks/useFeatureTreatment";

vi.mock("../../src/hooks/useFeatureTreatment", () => ({ useFeatureTreatment: vi.fn() }));
vi.mock("../../src/components/pages/MarketingPage", () => ({
  MarketingPage: ({ onEnter }: { onEnter: () => void }) => (
    <button type="button" onClick={onEnter}>
      Marketing
    </button>
  ),
}));

type FlagState = { treatment: string | null | undefined; isLoading: boolean };
const LOADED_C: FlagState = { treatment: "C", isLoading: false };

/** `state` is MARKETING_PAGE's; MARKETING_STICKY_ENTRY is `sticky` (C unless a test says otherwise). */
function mockFlags(state: FlagState, sticky: FlagState = LOADED_C) {
  vi.mocked(useFeatureTreatment).mockImplementation((key: string) => (key === "MARKETING_STICKY_ENTRY" ? sticky : state));
}

const tree = (path: string) => (
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route element={<MarketingGate />}>
        <Route path="/" element={<p>Map</p>} />
        <Route path="/data" element={<p>Data</p>} />
      </Route>
    </Routes>
  </MemoryRouter>
);

function renderAt(path: string, state: FlagState, sticky: FlagState = LOADED_C) {
  mockFlags(state, sticky);
  return render(tree(path));
}

afterEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("MarketingGate", () => {
  it("shows the marketing page at / on T1, and the map once the visitor enters", async () => {
    renderAt("/", { treatment: "T1", isLoading: false });
    expect(useFeatureTreatment).toHaveBeenCalledWith("MARKETING_PAGE");
    expect(useFeatureTreatment).toHaveBeenCalledWith("MARKETING_STICKY_ENTRY");
    await userEvent.click(await screen.findByRole("button", { name: "Marketing" }));
    expect(screen.getByText("Map")).toBeInTheDocument();
    expect(window.sessionStorage.getItem(MARKETING_ENTERED_KEY)).toBe("1");
  });

  it("goes straight to the map for a visitor who already entered this session", () => {
    window.sessionStorage.setItem(MARKETING_ENTERED_KEY, "1");
    renderAt("/", { treatment: "T1", isLoading: false });
    expect(screen.getByText("Map")).toBeInTheDocument();
  });

  it("keeps the map at / on C, or when the flag is missing", () => {
    renderAt("/", { treatment: "C", isLoading: false });
    expect(screen.getByText("Map")).toBeInTheDocument();
  });

  it("renders nothing at / while the flag loads", () => {
    renderAt("/", { treatment: undefined, isLoading: true });
    expect(screen.queryByText("Map")).not.toBeInTheDocument();
    expect(screen.queryByText("Marketing")).not.toBeInTheDocument();
  });

  it("never intercepts any other path", () => {
    renderAt("/data", { treatment: "T1", isLoading: false });
    expect(screen.getByText("Data")).toBeInTheDocument();
  });

  it("still enters when session storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    renderAt("/", { treatment: "T1", isLoading: false });
    await userEvent.click(await screen.findByRole("button", { name: "Marketing" }));
    expect(screen.getByText("Map")).toBeInTheDocument();
  });
});

describe("MarketingGate, MARKETING_STICKY_ENTRY on C", () => {
  it("ignores a stored entry and writes none: the marketing page as today", async () => {
    const seeded = "2026-11-14T00:00:00.000Z";
    window.localStorage.setItem(MARKETING_ENTERED_AT_KEY, seeded);
    renderAt("/", { treatment: "T1", isLoading: false });
    await userEvent.click(await screen.findByRole("button", { name: "Marketing" }));
    expect(screen.getByText("Map")).toBeInTheDocument();
    expect(window.localStorage.getItem(MARKETING_ENTERED_AT_KEY)).toBe(seeded);
  });

  it("forgets the entry in a new tab", async () => {
    const first = renderAt("/", { treatment: "T1", isLoading: false });
    await userEvent.click(await screen.findByRole("button", { name: "Marketing" }));
    first.unmount();
    window.sessionStorage.clear();
    renderAt("/", { treatment: "T1", isLoading: false });
    expect(await screen.findByRole("button", { name: "Marketing" })).toBeInTheDocument();
  });

  it("waits for the sticky flag before showing the marketing page", () => {
    renderAt("/", { treatment: "T1", isLoading: false }, { treatment: undefined, isLoading: true });
    expect(screen.queryByText("Map")).not.toBeInTheDocument();
    expect(screen.queryByText("Marketing")).not.toBeInTheDocument();
  });
});

describe("MarketingGate, MARKETING_STICKY_ENTRY on T1", () => {
  const ON: FlagState = { treatment: "T1", isLoading: false };

  it("remembers the entry in a new tab", async () => {
    const first = renderAt("/", ON, ON);
    await userEvent.click(await screen.findByRole("button", { name: "Marketing" }));
    expect(window.localStorage.getItem(MARKETING_ENTERED_AT_KEY)).not.toBeNull();
    first.unmount();
    window.sessionStorage.clear();
    renderAt("/", ON, ON);
    expect(screen.getByText("Map")).toBeInTheDocument();
  });

  it("shows the marketing page again for an entry 8 days old, and removes it", async () => {
    window.localStorage.setItem(MARKETING_ENTERED_AT_KEY, new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString());
    renderAt("/", ON, ON);
    expect(await screen.findByRole("button", { name: "Marketing" })).toBeInTheDocument();
    expect(window.localStorage.getItem(MARKETING_ENTERED_AT_KEY)).toBeNull();
  });

  it("re-reads the stored entry once the sticky flag resolves", () => {
    window.localStorage.setItem(MARKETING_ENTERED_AT_KEY, new Date().toISOString());
    const view = renderAt("/", ON, { treatment: undefined, isLoading: true });
    expect(screen.queryByText("Map")).not.toBeInTheDocument();
    mockFlags(ON, ON);
    view.rerender(tree("/"));
    expect(screen.getByText("Map")).toBeInTheDocument();
  });

  it("shows the marketing page again when the entry is cleared", async () => {
    renderAt("/", ON, ON);
    await userEvent.click(await screen.findByRole("button", { name: "Marketing" }));
    expect(screen.getByText("Map")).toBeInTheDocument();
    act(() => clearMarketingEntry());
    expect(await screen.findByRole("button", { name: "Marketing" })).toBeInTheDocument();
  });
});
