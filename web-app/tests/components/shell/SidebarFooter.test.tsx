import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { SidebarFooter } from "../../../src/components/shell/SidebarFooter";
import { ThemeProvider } from "../../../src/components/shell/ThemeProvider";
import { useAuth } from "../../../src/hooks/useAuth";
import { THEME_STORAGE_KEY } from "../../../src/models/theme";
import { ADMIN_USER, authResult } from "../../testUtils/authFixtures";

vi.mock("../../../src/hooks/useAuth", () => ({ useAuth: vi.fn() }));
const mockedUseAuth = vi.mocked(useAuth);

function CurrentPath() {
  return <p data-testid="path">{useLocation().pathname}</p>;
}

function renderFooter(path = "/", collapsed = false) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <SidebarFooter collapsed={collapsed} />
        <CurrentPath />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  vi.unstubAllGlobals();
});

describe("SidebarFooter — About", () => {
  it("opens the About drawer from a button without navigating, and returns focus on close", async () => {
    mockedUseAuth.mockReturnValue(authResult());
    renderFooter("/data");
    const user = userEvent.setup();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "About" }));
    const dialog = screen.getByRole("dialog", { name: "About BoroughSim" });
    expect(dialog.parentElement).toBe(document.body);
    expect(screen.getByTestId("path")).toHaveTextContent("/data");

    await user.click(screen.getByRole("button", { name: "Close About" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "About" })).toHaveFocus();
    expect(screen.getByTestId("path")).toHaveTextContent("/data");
  });

  it("toggles: clicking About a second time closes the drawer, and exposes its state", async () => {
    mockedUseAuth.mockReturnValue(authResult());
    renderFooter("/data");
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "About" });

    expect(button).toHaveAttribute("aria-expanded", "false");
    await user.click(button);
    expect(screen.getByRole("dialog", { name: "About BoroughSim" })).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "true");

    await user.click(button);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("path")).toHaveTextContent("/data");
  });

  it("toggling About closed at the /about route also returns to /", async () => {
    mockedUseAuth.mockReturnValue(authResult());
    renderFooter("/about");
    await userEvent.setup().click(screen.getByRole("button", { name: "About" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("path")).toHaveTextContent(/^\/$/);
  });

  it("opens the same drawer at the /about route, and closing it returns to /", async () => {
    mockedUseAuth.mockReturnValue(authResult());
    renderFooter("/about");
    expect(screen.getByRole("dialog", { name: "About BoroughSim" })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Close About" }));
    expect(screen.getByTestId("path")).toHaveTextContent(/^\/$/);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("collapsed: About stays reachable by its accessible name, without visible text", () => {
    mockedUseAuth.mockReturnValue(authResult());
    renderFooter("/", true);
    const button = screen.getByRole("button", { name: "About" });
    expect(button).not.toHaveTextContent("About");
  });
});

describe("SidebarFooter — layout", () => {
  it("puts About and the theme switch side by side on a single line", () => {
    mockedUseAuth.mockReturnValue(authResult());
    renderFooter();
    const row = screen.getByRole("button", { name: "About" }).parentElement!;
    expect(row).toContainElement(screen.getByRole("radiogroup", { name: "Theme" }));
    expect(row).toHaveClass("flex", "items-center");
    expect(row).not.toHaveClass("flex-col");
    expect(screen.getByRole("button", { name: "About" })).toHaveClass("flex-1");
  });

  it("collapsed rail: the same two controls stack, since the rail is too narrow for one line", () => {
    mockedUseAuth.mockReturnValue(authResult());
    renderFooter("/", true);
    const row = screen.getByRole("button", { name: "About" }).parentElement!;
    expect(row).toContainElement(screen.getByRole("radiogroup", { name: "Theme" }));
    expect(row).toHaveClass("flex-col");
  });
});

describe("SidebarFooter — theme toggle", () => {
  it("is a two-option radio group with sun (light) on the left and moon (dark) on the right", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    mockedUseAuth.mockReturnValue(authResult());
    renderFooter();
    const group = screen.getByRole("radiogroup", { name: "Theme" });
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("aria-label"))).toEqual(["Light theme", "Dark theme"]);
    expect(screen.getByRole("radio", { name: "Dark theme" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Light theme" })).not.toBeChecked();
  });

  it("switches between dark and light, updating <html> and localStorage", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    mockedUseAuth.mockReturnValue(authResult());
    renderFooter();
    const user = userEvent.setup();
    expect(document.documentElement.getAttribute("data-theme")).toBe("DARK");

    await user.click(screen.getByRole("radio", { name: "Light theme" }));
    expect(screen.getByRole("radio", { name: "Light theme" })).toBeChecked();
    expect(document.documentElement.getAttribute("data-theme")).toBe("LIGHT");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("LIGHT");

    await user.click(screen.getByRole("radio", { name: "Dark theme" }));
    expect(screen.getByRole("radio", { name: "Dark theme" })).toBeChecked();
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("DARK");
  });

  it("restores a stored light theme on load", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "LIGHT");
    mockedUseAuth.mockReturnValue(authResult());
    renderFooter();
    expect(screen.getByRole("radio", { name: "Light theme" })).toBeChecked();
  });

  it("supports keyboard selection with the arrow keys", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    mockedUseAuth.mockReturnValue(authResult());
    renderFooter();
    const user = userEvent.setup();
    screen.getByRole("radio", { name: "Dark theme" }).focus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Light theme" })).toBeChecked();
  });

  it("collapsed rail: the same radios, stacked vertically", () => {
    mockedUseAuth.mockReturnValue(authResult());
    renderFooter("/", true);
    expect(screen.getByRole("radiogroup", { name: "Theme" })).toHaveClass("flex-col");
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });
});

describe("SidebarFooter — signed-in user", () => {
  it("shows no email or sign-out when signed out", () => {
    mockedUseAuth.mockReturnValue(authResult());
    renderFooter();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });

  it("shows the admin email and signs out", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue(authResult({ user: ADMIN_USER, signOut }));
    renderFooter();
    expect(screen.getByText("admin@example.com")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalled();
  });

  it("collapsed: hides the email but keeps an icon-only Sign out", () => {
    mockedUseAuth.mockReturnValue(authResult({ user: ADMIN_USER }));
    renderFooter("/", true);
    expect(screen.queryByText("admin@example.com")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
