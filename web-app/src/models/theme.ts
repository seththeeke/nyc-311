import { z } from "zod";

/*
 * A theme is a named set of design tokens (index.css), applied by a
 * data-theme attribute on <html>. Only the name is persisted, in
 * localStorage — a per-browser preference, never sent to a backend.
 */

export const THEME_NAMES = ["DARK", "LIGHT"] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

export const ThemeNameSchema = z.enum(THEME_NAMES);

export const DEFAULT_THEME: ThemeName = "DARK";

/* Must match the key hard-coded in index.html's pre-paint script. */
export const THEME_STORAGE_KEY = "nyc311.theme";
