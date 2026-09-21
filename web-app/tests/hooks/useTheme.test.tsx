import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { readStoredTheme, resolveInitialTheme, useTheme, writeStoredTheme } from "../../src/hooks/useTheme";
import { THEME_STORAGE_KEY } from "../../src/models/theme";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("readStoredTheme / writeStoredTheme", () => {
  it("round-trips a valid theme", () => {
    writeStoredTheme("LIGHT");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("LIGHT");
    expect(readStoredTheme()).toBe("LIGHT");
  });

  it("returns null when nothing is stored", () => {
    expect(readStoredTheme()).toBeNull();
  });

  it("returns null for a garbage stored value", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "hotdog");
    expect(readStoredTheme()).toBeNull();
  });

  it("returns null when reading storage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
    });
    expect(readStoredTheme()).toBeNull();
  });

  it("swallows a throwing write", () => {
    const setItem = vi.fn(() => {
      throw new Error("quota");
    });
    vi.stubGlobal("localStorage", { setItem });
    expect(() => writeStoredTheme("DARK")).not.toThrow();
    expect(setItem).toHaveBeenCalled();
  });
});

describe("resolveInitialTheme", () => {
  it("prefers the stored value", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "LIGHT");
    expect(resolveInitialTheme()).toBe("LIGHT");
  });

  it("falls back to the OS light preference", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    expect(resolveInitialTheme()).toBe("LIGHT");
  });

  it("falls back to DARK when the OS has no light preference", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    expect(resolveInitialTheme()).toBe("DARK");
  });

  it("falls back to DARK when matchMedia throws", () => {
    vi.stubGlobal("matchMedia", () => {
      throw new Error("unsupported");
    });
    expect(resolveInitialTheme()).toBe("DARK");
  });
});

describe("useTheme", () => {
  it("throws outside a ThemeProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useTheme())).toThrow(/ThemeProvider/);
  });
});
