import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useShellLayout } from "../../src/hooks/useShellLayout";
import { mockViewport } from "../testUtils/viewport";

afterEach(() => vi.unstubAllGlobals());

describe("useShellLayout", () => {
  it("wide: both panels open by default", () => {
    mockViewport(1400);
    const { result } = renderHook(() => useShellLayout());
    expect(result.current.breakpoint).toBe("WIDE");
    expect(result.current.sidebarCollapsed).toBe(false);
    expect(result.current.rightCollapsed).toBe(false);
    expect(result.current.isOverlay).toBe(false);
  });

  it("medium: right panel auto-collapses, sidebar stays docked", () => {
    mockViewport(900);
    const { result } = renderHook(() => useShellLayout());
    expect(result.current.breakpoint).toBe("MEDIUM");
    expect(result.current.rightCollapsed).toBe(true);
    expect(result.current.sidebarCollapsed).toBe(false);
  });

  it("narrow: sidebar becomes a closed overlay; right panel collapsed", () => {
    mockViewport(500);
    const { result } = renderHook(() => useShellLayout());
    expect(result.current.breakpoint).toBe("NARROW");
    expect(result.current.isOverlay).toBe(true);
    expect(result.current.overlayOpen).toBe(false);
    expect(result.current.sidebarCollapsed).toBe(false);
    expect(result.current.rightCollapsed).toBe(true);
  });

  it("toggles the sidebar rail and expands it again", () => {
    mockViewport(1400);
    const { result } = renderHook(() => useShellLayout());
    act(() => result.current.toggleSidebar());
    expect(result.current.sidebarCollapsed).toBe(true);
    act(() => result.current.expandSidebar());
    expect(result.current.sidebarCollapsed).toBe(false);
    act(() => result.current.toggleSidebar());
    act(() => result.current.toggleSidebar());
    expect(result.current.sidebarCollapsed).toBe(false);
  });

  it("manual toggle overrides the auto right-panel state, both ways", () => {
    mockViewport(900);
    const { result } = renderHook(() => useShellLayout());
    act(() => result.current.toggleRight());
    expect(result.current.rightCollapsed).toBe(false);
    act(() => result.current.toggleRight());
    expect(result.current.rightCollapsed).toBe(true);
  });

  it("narrow: toggle/expand open the overlay and closeOverlay shuts it", () => {
    mockViewport(500);
    const { result } = renderHook(() => useShellLayout());
    act(() => result.current.toggleSidebar());
    expect(result.current.overlayOpen).toBe(true);
    act(() => result.current.closeOverlay());
    expect(result.current.overlayOpen).toBe(false);
    act(() => result.current.expandSidebar());
    expect(result.current.overlayOpen).toBe(true);
    act(() => result.current.toggleSidebar());
    expect(result.current.overlayOpen).toBe(false);
  });

  it("crossing a breakpoint discards manual overrides", () => {
    const viewport = mockViewport(1400);
    const { result } = renderHook(() => useShellLayout());
    act(() => result.current.toggleSidebar());
    act(() => result.current.toggleRight());
    expect(result.current.sidebarCollapsed).toBe(true);
    expect(result.current.rightCollapsed).toBe(true);

    act(() => viewport.setWidth(900));
    expect(result.current.breakpoint).toBe("MEDIUM");
    expect(result.current.sidebarCollapsed).toBe(false);
    expect(result.current.rightCollapsed).toBe(true);

    act(() => viewport.setWidth(1400));
    expect(result.current.rightCollapsed).toBe(false);
  });

  it("closes an open overlay when leaving the narrow breakpoint", () => {
    const viewport = mockViewport(500);
    const { result } = renderHook(() => useShellLayout());
    act(() => result.current.toggleSidebar());
    act(() => viewport.setWidth(900));
    expect(result.current.overlayOpen).toBe(false);
  });
});
