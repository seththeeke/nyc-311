import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, useLocation } from "react-router-dom";
import { Sidebar } from "../../../src/components/shell/Sidebar";
import { ThemeProvider } from "../../../src/components/shell/ThemeProvider";
import { useAuth } from "../../../src/hooks/useAuth";
import { ADMIN_USER, authResult } from "../../testUtils/authFixtures";

vi.mock("../../../src/hooks/useAuth", () => ({ useAuth: vi.fn() }));
const mockedUseAuth = vi.mocked(useAuth);

function CurrentPath() {
  return <p data-testid="path">{useLocation().pathname}</p>;
}

interface Options {
  path?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onExpand?: () => void;
  onNavigate?: () => void;
}

function renderSidebar({ path = "/", collapsed = false, ...handlers }: Options = {}) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={handlers.onToggleCollapse ?? vi.fn()}
          onExpand={handlers.onExpand ?? vi.fn()}
          onNavigate={handlers.onNavigate ?? vi.fn()}
        />
        <CurrentPath />
        <Link to="/monitoring/pipeline">external jump</Link>
        <Link to="/admin/capacity">admin jump</Link>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe("Sidebar menu", () => {
  it("force-opens a closed accordion when the route moves into it from outside the menu", async () => {
    mockedUseAuth.mockReturnValue(authResult({ user: ADMIN_USER }));
    renderSidebar();
    const user = userEvent.setup();
    const monitoring = screen.getByRole("button", { name: "System Monitoring" });
    expect(monitoring).toHaveAttribute("aria-expanded", "false");

    await user.click(screen.getByRole("link", { name: "external jump" }));
    expect(monitoring).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Admin" })).toHaveAttribute("aria-expanded", "false");

    await user.click(screen.getByRole("link", { name: "admin jump" }));
    expect(screen.getByRole("button", { name: "Admin" })).toHaveAttribute("aria-expanded", "true");
    expect(monitoring).toHaveAttribute("aria-expanded", "true");
  });

  it("shows the three primary entries", () => {
    mockedUseAuth.mockReturnValue(authResult());
    renderSidebar();
    expect(screen.getByRole("link", { name: "Map" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "System Monitoring" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Admin/ })).toBeInTheDocument();
  });

  it("marks Map as the current page on / and on /about", () => {
    mockedUseAuth.mockReturnValue(authResult());
    const { unmount } = renderSidebar({ path: "/" });
    expect(screen.getByRole("link", { name: "Map" })).toHaveAttribute("aria-current", "page");
    unmount();
    renderSidebar({ path: "/about" });
    expect(screen.getByRole("link", { name: "Map" })).toHaveAttribute("aria-current", "page");
  });

  it("starts with both accordions closed on the map", () => {
    mockedUseAuth.mockReturnValue(authResult());
    renderSidebar();
    expect(screen.getByRole("button", { name: "System Monitoring" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Ingestion" })).not.toBeInTheDocument();
  });

  it("expands and collapses the monitoring accordion, listing its six items", async () => {
    mockedUseAuth.mockReturnValue(authResult());
    renderSidebar();
    const user = userEvent.setup();
    const header = screen.getByRole("button", { name: "System Monitoring" });

    await user.click(header);
    expect(header).toHaveAttribute("aria-expanded", "true");
    const group = screen.getByRole("group", { name: "System Monitoring" });
    expect(within(group).getAllByRole("link")).toHaveLength(6);
    expect(within(group).getByRole("link", { name: "Ingestion" })).toHaveAttribute("href", "/monitoring/ingestion");
    expect(within(group).getByRole("link", { name: "Data Modeling" })).toHaveAttribute("href", "/data");

    await user.click(header);
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("group", { name: "System Monitoring" })).not.toBeInTheDocument();
  });

  it("opens Test Coverage in a new tab instead of routing", async () => {
    mockedUseAuth.mockReturnValue(authResult());
    renderSidebar();
    await userEvent.setup().click(screen.getByRole("button", { name: "System Monitoring" }));
    const link = screen.getByRole("link", { name: /Test Coverage/ });
    expect(link).toHaveAttribute("href", "/coverage/index.html");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("auto-expands the accordion the current route is inside, and highlights the item", () => {
    mockedUseAuth.mockReturnValue(authResult({ user: ADMIN_USER }));
    renderSidebar({ path: "/monitoring/pipeline" });
    expect(screen.getByRole("button", { name: "System Monitoring" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Pipeline" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Admin" })).toHaveAttribute("aria-expanded", "false");
  });

  it("auto-expands when the route moves into a section after mount", async () => {
    mockedUseAuth.mockReturnValue(authResult({ user: ADMIN_USER }));
    renderSidebar();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Admin" }));
    await user.click(screen.getByRole("link", { name: "Capacity" }));
    expect(screen.getByTestId("path")).toHaveTextContent("/admin/capacity");
    expect(screen.getByRole("link", { name: "Capacity" })).toHaveAttribute("aria-current", "page");
    /* Navigating within an open section doesn't re-force it open after the user closes it. */
    await user.click(screen.getByRole("button", { name: "Admin" }));
    expect(screen.getByRole("button", { name: "Admin" })).toHaveAttribute("aria-expanded", "false");
  });

  it("calls onNavigate when a link is followed", async () => {
    mockedUseAuth.mockReturnValue(authResult());
    const onNavigate = vi.fn();
    renderSidebar({ path: "/data", onNavigate });
    await userEvent.setup().click(screen.getByRole("link", { name: "Map" }));
    expect(onNavigate).toHaveBeenCalled();
  });
});

describe("Sidebar Admin lock", () => {
  it("signed out: the Admin header and all three items show a lock, and the accordion still expands", async () => {
    mockedUseAuth.mockReturnValue(authResult());
    renderSidebar();
    const header = screen.getByRole("button", { name: /^Admin/ });
    expect(header).toHaveTextContent("locked");
    await userEvent.setup().click(header);
    const group = screen.getByRole("group", { name: "Admin" });
    const links = within(group).getAllByRole("link");
    expect(links).toHaveLength(3);
    for (const link of links) expect(link).toHaveTextContent("locked");
  });

  it("signed out: clicking an item navigates to its admin path (AdminRoute then redirects to /login)", async () => {
    mockedUseAuth.mockReturnValue(authResult());
    renderSidebar();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^Admin/ }));
    await user.click(screen.getByRole("link", { name: /Warehouse/ }));
    expect(screen.getByTestId("path")).toHaveTextContent("/admin/warehouse");
  });

  it("signed in: no lock on the header or items", async () => {
    mockedUseAuth.mockReturnValue(authResult({ user: ADMIN_USER }));
    renderSidebar();
    const header = screen.getByRole("button", { name: "Admin" });
    expect(header).not.toHaveTextContent("locked");
    await userEvent.setup().click(header);
    for (const link of within(screen.getByRole("group", { name: "Admin" })).getAllByRole("link")) {
      expect(link).not.toHaveTextContent("locked");
    }
  });

  it("does not flash the lock while the session check is still loading", () => {
    mockedUseAuth.mockReturnValue(authResult({ user: undefined, isLoading: true }));
    renderSidebar();
    expect(screen.getByRole("button", { name: "Admin" })).not.toHaveTextContent("locked");
  });
});

describe("Sidebar collapse", () => {
  it("expanded: brand text, 'Collapse menu' button, labelled sections", async () => {
    mockedUseAuth.mockReturnValue(authResult());
    const onToggleCollapse = vi.fn();
    renderSidebar({ onToggleCollapse });
    expect(screen.getByText("BoroughSim")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Collapse menu" }));
    expect(onToggleCollapse).toHaveBeenCalled();
  });

  it("collapsed rail: icon-only controls keep accessible names, and no item lists render", () => {
    mockedUseAuth.mockReturnValue(authResult());
    renderSidebar({ collapsed: true, path: "/monitoring/pipeline" });
    expect(screen.getByRole("button", { name: "Expand menu" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Map" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "System Monitoring" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Admin (locked)" })).toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(screen.queryByText("BoroughSim")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "BoroughSim" })).toHaveAttribute("href", "/");
  });

  it("collapsed rail: clicking a group icon expands the sidebar with that accordion open", async () => {
    mockedUseAuth.mockReturnValue(authResult({ user: ADMIN_USER }));
    const onExpand = vi.fn();
    renderSidebar({ collapsed: true, onExpand });
    await userEvent.setup().click(screen.getByRole("button", { name: "Admin" }));
    expect(onExpand).toHaveBeenCalled();
  });

  it("expanding after a rail click leaves that accordion open", async () => {
    mockedUseAuth.mockReturnValue(authResult({ user: ADMIN_USER }));
    const { rerender } = renderSidebar({ collapsed: true });
    await userEvent.setup().click(screen.getByRole("button", { name: "Admin" }));
    rerender(
      <ThemeProvider>
        <MemoryRouter>
          <Sidebar collapsed={false} onToggleCollapse={vi.fn()} onExpand={vi.fn()} onNavigate={vi.fn()} />
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(screen.getByRole("group", { name: "Admin" })).toBeInTheDocument();
  });
});
