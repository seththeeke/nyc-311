import { useCallback, useEffect, useMemo, useState, type ReactElement, type ReactNode } from "react";
import { ThemeContext, resolveInitialTheme, writeStoredTheme, type ThemeContextValue } from "../../hooks/useTheme";
import type { ThemeName } from "../../models/theme";

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * Owns the active theme: applies it to `<html data-theme>` and persists
 * changes to localStorage. index.html's inline script has already applied
 * the same resolved value before first paint, so this never flashes.
 */
export function ThemeProvider({ children }: ThemeProviderProps): ReactElement {
  const [theme, setThemeState] = useState<ThemeName>(resolveInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const setTheme = useCallback((next: ThemeName): void => {
    writeStoredTheme(next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback((): void => {
    setTheme(theme === "DARK" ? "LIGHT" : "DARK");
  }, [theme, setTheme]);

  const value = useMemo<ThemeContextValue>(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
