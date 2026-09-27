import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { FeatureFlagsPage } from "../../../src/components/pages/FeatureFlagsPage";
import { useFeatureFlags, type UseFeatureFlagsResult } from "../../../src/hooks/useFeatureFlags";
import { MOCK_FEATURE_FLAGS } from "../../../src/test-data/featureFlags";

vi.mock("../../../src/hooks/useFeatureFlags", () => ({ useFeatureFlags: vi.fn() }));
const mockedUseFeatureFlags = vi.mocked(useFeatureFlags);

function mockHook(overrides: Partial<UseFeatureFlagsResult> = {}): void {
  mockedUseFeatureFlags.mockReturnValue({
    flags: MOCK_FEATURE_FLAGS,
    isLoading: false,
    error: null,
    createFlag: vi.fn(),
    updateFlag: vi.fn(),
    deleteFlag: vi.fn(),
    ...overrides,
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <FeatureFlagsPage />
    </MemoryRouter>
  );
}

describe("FeatureFlagsPage", () => {
  it("links back to /admin and lists every flag collapsed", () => {
    mockHook();
    renderPage();
    expect(screen.getByRole("link", { name: /Admin/ })).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("button", { name: /^COST_MODEL default/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /^FAILURE_INJECTION default/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("expands one row at a time and collapses it again", async () => {
    mockHook();
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^COST_MODEL default/ }));
    expect(screen.getByRole("button", { name: /^COST_MODEL default/ })).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("button", { name: /^FAILURE_INJECTION default/ }));
    expect(screen.getByRole("button", { name: /^COST_MODEL default/ })).toHaveAttribute("aria-expanded", "false");
    await user.click(screen.getByRole("button", { name: /^FAILURE_INJECTION default/ }));
    expect(screen.getByRole("button", { name: /^FAILURE_INJECTION default/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("opens and discards a new-flag editor", async () => {
    mockHook();
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "+ New flag" }));
    expect(screen.getByRole("heading", { name: "New flag" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByRole("button", { name: "+ New flag" })).toBeInTheDocument();
  });

  it("shows an empty state", () => {
    mockHook({ flags: [] });
    renderPage();
    expect(screen.getByText("No feature flags yet.")).toBeInTheDocument();
  });

  it("shows loading and error states", () => {
    mockHook({ flags: undefined, isLoading: true, error: new Error("down") });
    renderPage();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("down");
  });
});
