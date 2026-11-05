import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import { useRef, type ReactElement } from "react";
import { useInView } from "../../../src/components/marketing/useInView";
import { easeOutExpo, useCountUp } from "../../../src/components/marketing/useCountUp";

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
