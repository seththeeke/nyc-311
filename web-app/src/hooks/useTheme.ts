import { createContext, useContext } from "react";
import { DEFAULT_THEME, THEME_STORAGE_KEY, ThemeNameSchema, type ThemeName } from "../models/theme";

export interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

/*
 * Every storage access is try/caught: localStorage can throw or be empty in
 * a private window, with blocked site data, or in previews — the app must
 * render correctly without it.
 */
export function readStoredTheme(): ThemeName | null {
  try {
    const parsed = ThemeNameSchema.safeParse(window.localStorage.getItem(THEME_STORAGE_KEY));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeStoredTheme(theme: ThemeName): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* Storage unavailable — the theme still applies for this session. */
  }
}

/** Stored value, else the OS colour-scheme preference, else DARK. */
export function resolveInitialTheme(): ThemeName {
  const stored = readStoredTheme();
  if (stored) return stored;
  try {
    if (window.matchMedia("(prefers-color-scheme: light)").matches) return "LIGHT";
  } catch {
    /* matchMedia unavailable — fall through to the default. */
  }
  return DEFAULT_THEME;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside a ThemeProvider");
  return value;
}
