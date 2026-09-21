import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { ThemeProvider } from "../../../src/components/shell/ThemeProvider";
import { useTheme } from "../../../src/hooks/useTheme";
import { THEME_STORAGE_KEY } from "../../../src/models/theme";

function Probe() {
  const { theme, setTheme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={toggleTheme}>toggle</button>
      <button onClick={() => setTheme("LIGHT")}>light</button>
    </div>
  );
}

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  vi.unstubAllGlobals();
});

describe("ThemeProvider", () => {
  it("applies the resolved theme to <html> and starts from storage", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "LIGHT");
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("LIGHT");
    expect(document.documentElement.getAttribute("data-theme")).toBe("LIGHT");
  });

  it("toggles, updates <html>, and persists", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("DARK");
    act(() => screen.getByText("toggle").click());
    expect(screen.getByTestId("theme")).toHaveTextContent("LIGHT");
    expect(document.documentElement.getAttribute("data-theme")).toBe("LIGHT");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("LIGHT");
    act(() => screen.getByText("toggle").click());
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("DARK");
  });

  it("setTheme picks a specific theme", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    act(() => screen.getByText("light").click());
    expect(screen.getByTestId("theme")).toHaveTextContent("LIGHT");
  });
});
