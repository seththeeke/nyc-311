import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { FeatureFlagRoute } from "../../src/routes/FeatureFlagRoute";
import { useFeatureTreatment } from "../../src/hooks/useFeatureTreatment";

vi.mock("../../src/hooks/useFeatureTreatment", () => ({ useFeatureTreatment: vi.fn() }));
const mockedTreatment = vi.mocked(useFeatureTreatment);

function renderAt(state: { treatment: string | null | undefined; isLoading: boolean }) {
  mockedTreatment.mockReturnValue(state);
  render(
    <MemoryRouter initialEntries={["/customers"]}>
      <Routes>
        <Route path="/" element={<p>Home</p>} />
        <Route
          path="/customers"
          element={
            <FeatureFlagRoute flagKey="CUSTOMERS_TAB" onTreatments={["T1", "T2"]}>
              <p>Customers</p>
            </FeatureFlagRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("FeatureFlagRoute", () => {
  it("shows the page when the flag is on", () => {
    renderAt({ treatment: "T1", isLoading: false });
    expect(screen.getByText("Customers")).toBeInTheDocument();
    expect(mockedTreatment).toHaveBeenCalledWith("CUSTOMERS_TAB");
  });

  it("shows the page on any of its treatments", () => {
    renderAt({ treatment: "T2", isLoading: false });
    expect(screen.getByText("Customers")).toBeInTheDocument();
  });

  it("renders nothing while the flag is loading", () => {
    renderAt({ treatment: undefined, isLoading: true });
    expect(screen.queryByText("Customers")).not.toBeInTheDocument();
    expect(screen.queryByText("Home")).not.toBeInTheDocument();
  });

  it("sends a typed URL home when the flag is off, missing or failed", () => {
    renderAt({ treatment: "C", isLoading: false });
    expect(screen.getByText("Home")).toBeInTheDocument();
  });

  it("treats a missing flag as off", () => {
    renderAt({ treatment: null, isLoading: false });
    expect(screen.getByText("Home")).toBeInTheDocument();
  });
});
