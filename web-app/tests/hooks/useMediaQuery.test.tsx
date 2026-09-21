import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMediaQuery } from "../../src/hooks/useMediaQuery";
import { mockViewport } from "../testUtils/viewport";

afterEach(() => vi.unstubAllGlobals());

describe("useMediaQuery", () => {
  it("reflects the current match and updates on change", () => {
    const viewport = mockViewport(500);
    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    expect(result.current).toBe(false);
    act(() => viewport.setWidth(900));
    expect(result.current).toBe(true);
  });

  it("is false when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", () => {
      throw new Error("unsupported");
    });
    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    expect(result.current).toBe(false);
  });

  it("stops listening on unmount", () => {
    const viewport = mockViewport(500);
    const { result, unmount } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    unmount();
    act(() => viewport.setWidth(900));
    expect(result.current).toBe(false);
  });
});
