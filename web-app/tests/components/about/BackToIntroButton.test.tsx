import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { BackToIntroButton } from "../../../src/components/about/BackToIntroButton";
import { useFeatureEnabled } from "../../../src/hooks/useFeatureTreatment";
import { MARKETING_ENTERED_AT_KEY, MARKETING_ENTERED_KEY } from "../../../src/routes/marketingEntry";

vi.mock("../../../src/hooks/useFeatureTreatment", () => ({ useFeatureEnabled: vi.fn(() => true) }));

function CurrentPath() {
  return <p data-testid="path">{useLocation().pathname}</p>;
}

function renderButton(path = "/data") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <BackToIntroButton />
      <CurrentPath />
    </MemoryRouter>,
  );
}

afterEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  vi.mocked(useFeatureEnabled).mockImplementation(() => true);
});

describe("BackToIntroButton", () => {
  it("reads both flags", () => {
    renderButton();
    expect(useFeatureEnabled).toHaveBeenCalledWith("MARKETING_PAGE", "T1");
    expect(useFeatureEnabled).toHaveBeenCalledWith("MARKETING_STICKY_ENTRY", "T1");
  });

  it("clears the entry in both stores and goes to /", async () => {
    window.sessionStorage.setItem(MARKETING_ENTERED_KEY, "1");
    window.localStorage.setItem(MARKETING_ENTERED_AT_KEY, new Date().toISOString());
    renderButton();
    await userEvent.click(screen.getByRole("button", { name: "Back to the intro" }));
    expect(window.sessionStorage.getItem(MARKETING_ENTERED_KEY)).toBeNull();
    expect(window.localStorage.getItem(MARKETING_ENTERED_AT_KEY)).toBeNull();
    expect(screen.getByTestId("path")).toHaveTextContent(/^\/$/);
  });

  it("is hidden when MARKETING_STICKY_ENTRY is off (C)", () => {
    vi.mocked(useFeatureEnabled).mockImplementation((key: string) => key !== "MARKETING_STICKY_ENTRY");
    renderButton();
    expect(screen.queryByRole("button", { name: "Back to the intro" })).not.toBeInTheDocument();
  });

  it("is hidden when MARKETING_PAGE is off", () => {
    vi.mocked(useFeatureEnabled).mockImplementation((key: string) => key !== "MARKETING_PAGE");
    renderButton();
    expect(screen.queryByRole("button", { name: "Back to the intro" })).not.toBeInTheDocument();
  });
});
