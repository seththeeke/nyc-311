import { useCallback, useState } from "react";
import { useMediaQuery } from "./useMediaQuery";

export type ShellBreakpoint = "WIDE" | "MEDIUM" | "NARROW";

export interface ShellLayout {
  breakpoint: ShellBreakpoint;
  /* Below 768px the sidebar is an overlay drawer instead of a docked rail. */
  isOverlay: boolean;
  sidebarCollapsed: boolean;
  overlayOpen: boolean;
  rightCollapsed: boolean;
  toggleSidebar: () => void;
  expandSidebar: () => void;
  closeOverlay: () => void;
  toggleRight: () => void;
}

/**
 * Collapse state for the two side panels (12-UX-workspace-refactor.md §3.4).
 * In-memory only — deliberately not in localStorage, that's just the theme.
 * The right panel auto-collapses below 1024px and on any route flagged
 * `hidesSecondary` (the monitoring/admin pages); a manual toggle overrides the
 * auto behaviour until the viewport next crosses a breakpoint or the route
 * changes — so returning to the map brings the panel back.
 */
export function useShellLayout(pathname: string, hidesSecondary: boolean): ShellLayout {
  const isWide = useMediaQuery("(min-width: 1024px)");
  const isMedium = useMediaQuery("(min-width: 768px)");
  const breakpoint: ShellBreakpoint = isWide ? "WIDE" : isMedium ? "MEDIUM" : "NARROW";
  const isOverlay = breakpoint === "NARROW";

  const [seenBreakpoint, setSeenBreakpoint] = useState<ShellBreakpoint>(breakpoint);
  const [seenPathname, setSeenPathname] = useState(pathname);
  const [sidebarOverride, setSidebarOverride] = useState<boolean | null>(null);
  const [rightOverride, setRightOverride] = useState<boolean | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);

  if (seenBreakpoint !== breakpoint) {
    setSeenBreakpoint(breakpoint);
    setSidebarOverride(null);
    setRightOverride(null);
    setOverlayOpen(false);
  }
  if (seenPathname !== pathname) {
    setSeenPathname(pathname);
    setRightOverride(null);
  }

  const sidebarCollapsed = !isOverlay && (sidebarOverride ?? false);
  const rightCollapsed = rightOverride ?? (hidesSecondary || breakpoint !== "WIDE");

  const toggleSidebar = useCallback((): void => {
    if (isOverlay) setOverlayOpen((open) => !open);
    else setSidebarOverride(!sidebarCollapsed);
  }, [isOverlay, sidebarCollapsed]);

  const expandSidebar = useCallback((): void => {
    if (isOverlay) setOverlayOpen(true);
    else setSidebarOverride(false);
  }, [isOverlay]);

  const closeOverlay = useCallback((): void => setOverlayOpen(false), []);
  const toggleRight = useCallback((): void => setRightOverride(!rightCollapsed), [rightCollapsed]);

  return {
    breakpoint,
    isOverlay,
    sidebarCollapsed,
    overlayOpen,
    rightCollapsed,
    toggleSidebar,
    expandSidebar,
    closeOverlay,
    toggleRight,
  };
}
