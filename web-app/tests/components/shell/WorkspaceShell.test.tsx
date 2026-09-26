import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../../../src/components/shell/ThemeProvider";
import { WorkspaceProvider } from "../../../src/components/shell/WorkspaceProvider";
import { WorkspaceShell } from "../../../src/components/shell/WorkspaceShell";
import { useAuth } from "../../../src/hooks/useAuth";
import { authResult } from "../../testUtils/authFixtures";
import { mockViewport } from "../../testUtils/viewport";

vi.mock("../../../src/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("../../../src/hooks/useFleetLocations", () => ({
  useFleetLocations: () => ({ locations: { operators: [] }, isLoading: false, error: null }),
}));
vi.mock("../../../src/hooks/usePollerMetrics", () => ({
  usePollerMetrics: () => ({ data: { cursor: null, metrics: [] }, isPending: false, isError: false }),
}));
vi.mock("../../../src/hooks/useWorkspaceMetrics", async () => {
  const { MOCK_WORKSPACE_METRICS } = await import("../../../src/test-data/workspaceMetrics");
  return { useWorkspaceMetrics: () => ({ data: MOCK_WORKSPACE_METRICS, isPending: false, isError: false }) };
});

function renderShell() {
  vi.mocked(useAuth).mockReturnValue(authResult());
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <WorkspaceProvider>
          <WorkspaceShell>
            <p>page content</p>
          </WorkspaceShell>
        </WorkspaceProvider>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("WorkspaceShell — wide", () => {
  it("renders the menu, the routed page in the primary workspace, and the secondary workspace", () => {
    mockViewport(1400);
    renderShell();
    expect(screen.getByRole("complementary", { name: "Menu" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Primary workspace" })).toHaveTextContent("page content");
    expect(screen.getByRole("complementary", { name: "Secondary workspace" })).toBeInTheDocument();
  });

  it("collapses the menu to a rail and expands it again", async () => {
    mockViewport(1400);
    renderShell();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Collapse menu" }));
    expect(screen.getByRole("button", { name: "Expand menu" })).toBeInTheDocument();
    expect(screen.queryByText("BoroughSim")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Expand menu" }));
    expect(screen.getByText("BoroughSim")).toBeInTheDocument();
  });

  it("hides the secondary workspace and offers a handle to bring it back", async () => {
    mockViewport(1400);
    renderShell();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Hide secondary panel" }));
    expect(screen.queryByRole("complementary", { name: "Secondary workspace" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show secondary panel" }));
    expect(screen.getByRole("complementary", { name: "Secondary workspace" })).toBeInTheDocument();
  });
});

describe("WorkspaceShell — narrower viewports", () => {
  it("medium: the secondary workspace auto-collapses but can be re-opened", async () => {
    mockViewport(900);
    renderShell();
    expect(screen.queryByRole("complementary", { name: "Secondary workspace" })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Show secondary panel" }));
    expect(screen.getByRole("complementary", { name: "Secondary workspace" })).toBeInTheDocument();
  });

  it("narrow: the menu is a hamburger-opened overlay that closes on backdrop click", async () => {
    mockViewport(500);
    renderShell();
    const user = userEvent.setup();
    expect(screen.queryByRole("complementary", { name: "Menu" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("complementary", { name: "Menu" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open menu" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close menu" }));
    expect(screen.queryByRole("complementary", { name: "Menu" })).not.toBeInTheDocument();
  });

  it("narrow: following a menu link closes the overlay", async () => {
    mockViewport(500);
    renderShell();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await user.click(screen.getByRole("link", { name: "Map" }));
    expect(screen.queryByRole("complementary", { name: "Menu" })).not.toBeInTheDocument();
  });

  it("narrow: the overlay's collapse button also closes it", async () => {
    mockViewport(500);
    renderShell();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await user.click(screen.getByRole("button", { name: "Collapse menu" }));
    expect(screen.queryByRole("complementary", { name: "Menu" })).not.toBeInTheDocument();
  });

  it("re-flows when the viewport widens: docked menu and secondary panel return", () => {
    const viewport = mockViewport(500);
    renderShell();
    act(() => viewport.setWidth(1400));
    expect(screen.getByRole("complementary", { name: "Menu" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Secondary workspace" })).toBeInTheDocument();
  });
});
