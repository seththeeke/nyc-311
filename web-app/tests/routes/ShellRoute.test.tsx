import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "../../src/components/shell/ThemeProvider";
import { ShellRoute } from "../../src/routes/ShellRoute";
import { useAuth } from "../../src/hooks/useAuth";
import { authResult } from "../testUtils/authFixtures";

vi.mock("../../src/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("../../src/hooks/useFleetLocations", () => ({
  useFleetLocations: () => ({ locations: { operators: [] }, isLoading: false, error: null }),
}));
vi.mock("../../src/hooks/usePollerMetrics", () => ({
  usePollerMetrics: () => ({ data: { cursor: null, metrics: [] }, isPending: false, isError: false }),
}));

describe("ShellRoute", () => {
  it("renders the routed child inside the primary workspace, with the shell around it", () => {
    vi.mocked(useAuth).mockReturnValue(authResult());
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/x"]}>
          <Routes>
            <Route element={<ShellRoute />}>
              <Route path="/x" element={<p>child page</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(screen.getByRole("region", { name: "Primary workspace" })).toHaveTextContent("child page");
    expect(screen.getByRole("complementary", { name: "Menu" })).toBeInTheDocument();
  });
});
