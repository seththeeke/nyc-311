import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MARKETING_ENTERED_KEY, MarketingGate } from "../../src/routes/MarketingGate";
import { useFeatureTreatment } from "../../src/hooks/useFeatureTreatment";

vi.mock("../../src/hooks/useFeatureTreatment", () => ({ useFeatureTreatment: vi.fn() }));
vi.mock("../../src/components/pages/MarketingPage", () => ({
  MarketingPage: ({ onEnter }: { onEnter: () => void }) => (
    <button type="button" onClick={onEnter}>
      Marketing
    </button>
  ),
}));

function renderAt(path: string, state: { treatment: string | null | undefined; isLoading: boolean }) {
  vi.mocked(useFeatureTreatment).mockReturnValue(state);
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<MarketingGate />}>
          <Route path="/" element={<p>Map</p>} />
          <Route path="/data" element={<p>Data</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("MarketingGate", () => {
  it("shows the marketing page at / on T1, and the map once the visitor enters", async () => {
    renderAt("/", { treatment: "T1", isLoading: false });
    expect(useFeatureTreatment).toHaveBeenCalledWith("MARKETING_PAGE");
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
