import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import { useRef, type ReactElement } from "react";
import { useInView } from "../../../src/components/marketing/useInView";
import { easeOutExpo, useCountUp } from "../../../src/components/marketing/useCountUp";
import { scrollProgress, useScrollProgress } from "../../../src/components/marketing/useScrollProgress";

type ObserverCallback = (entries: { isIntersecting: boolean }[]) => void;

/* Installs a controllable IntersectionObserver and returns a trigger for its callback. */
function stubObserver(): { fire: (hit: boolean) => void; disconnect: ReturnType<typeof vi.fn> } {
  let callback: ObserverCallback = () => undefined;
  const disconnect = vi.fn();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: ObserverCallback) {
        callback = cb;
      }
      observe = vi.fn();
      disconnect = disconnect;
    },
  );
  return { fire: (hit) => act(() => callback([{ isIntersecting: hit }])), disconnect };
}

function Probe(): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  return <div ref={ref}>{inView ? "seen" : "hidden"}</div>;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useInView", () => {
  it("is in view everywhere IntersectionObserver is missing", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Probe />);
    expect(screen.getByText("seen")).toBeInTheDocument();
  });

  it("turns true once the element intersects, then stops observing", () => {
    const observer = stubObserver();
    render(<Probe />);
    observer.fire(false);
    expect(screen.getByText("hidden")).toBeInTheDocument();
    observer.fire(true);
    expect(screen.getByText("seen")).toBeInTheDocument();
    expect(observer.disconnect).toHaveBeenCalled();
  });
});

describe("useCountUp", () => {
  it("eases out and lands exactly on 1", () => {
    expect(easeOutExpo(0)).toBe(0);
    expect(easeOutExpo(0.5)).toBeGreaterThan(0.9);
    expect(easeOutExpo(1)).toBe(1);
  });

  it("stays null for a null target", () => {
    const { result } = renderHook(() => useCountUp(null, true, 100, false));
    expect(result.current).toBeNull();
  });

  it("waits at 0 until active, then counts to the target", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    const { result, rerender } = renderHook(({ active }) => useCountUp(500, active, 100, false), { initialProps: { active: false } });
    expect(result.current).toBe(0);
    rerender({ active: true });
    act(() => vi.advanceTimersByTime(50));
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(500);
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe(500);
  });

  it("jumps straight to the target when instant, and back to null if the target goes", () => {
    const { result, rerender } = renderHook(({ target }) => useCountUp(target, true, 100, true), { initialProps: { target: 42 as number | null } });
    expect(result.current).toBe(42);
    rerender({ target: null });
    expect(result.current).toBeNull();
  });
});

describe("scrollProgress", () => {
  it("runs from 0 at the bottom edge to 1 at the centre, clamped", () => {
    expect(scrollProgress({ top: 1000, height: 200 }, 800)).toBe(0);
    expect(scrollProgress({ top: 800, height: 200 }, 800)).toBe(0);
    expect(scrollProgress({ top: 300, height: 200 }, 800)).toBe(1);
    expect(scrollProgress({ top: -500, height: 200 }, 800)).toBe(1);
    expect(scrollProgress({ top: 550, height: 200 }, 800)).toBeCloseTo(0.5);
  });

  it("treats a degenerate span as complete", () => {
    expect(scrollProgress({ top: 0, height: -800 }, 800)).toBe(1);
  });
});

describe("useScrollProgress", () => {
  it("measures on mount and again after a scroll anywhere on the page", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
    const element = document.createElement("div");
    let top = 1000;
    element.getBoundingClientRect = () => ({ top, height: 200 }) as DOMRect;
    const { result, unmount } = renderHook(() => useScrollProgress({ current: element }));
    expect(result.current).toBe(0);
    top = -100;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(20);
    });
    expect(result.current).toBe(1);
    unmount();
  });

  it("does nothing without an element", () => {
    const { result } = renderHook(() => useScrollProgress({ current: null }));
    expect(result.current).toBe(0);
  });
});
