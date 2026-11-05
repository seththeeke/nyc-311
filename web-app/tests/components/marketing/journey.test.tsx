import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import { HowItWorks } from "../../../src/components/marketing/HowItWorks";
import { JOURNEY_STEPS } from "../../../src/components/marketing/journeySteps";
import { stepAt, stickyProgress, useStickyProgress } from "../../../src/components/marketing/useStickyProgress";
import { cardTransform } from "../../../src/components/marketing/JourneyCard";
import { useTicker } from "../../../src/components/marketing/useTicker";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useTicker", () => {
  it("counts up while playing and stops when not", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ playing }) => useTicker(100, playing), { initialProps: { playing: true } });
    act(() => vi.advanceTimersByTime(350));
    expect(result.current).toBe(3);
    rerender({ playing: false });
    act(() => vi.advanceTimersByTime(500));
    expect(result.current).toBe(3);
  });
});

describe("stickyProgress and stepAt", () => {
  it("runs 0 to 1 while the section scrolls past its pinned stage, clamped", () => {
    expect(stickyProgress({ top: 200, height: 3000 }, 1000)).toBe(0);
    expect(stickyProgress({ top: -1000, height: 3000 }, 1000)).toBe(0.5);
    expect(stickyProgress({ top: -5000, height: 3000 }, 1000)).toBe(1);
  });

  it("treats a section no taller than the viewport as done once its top passes", () => {
    expect(stickyProgress({ top: 10, height: 800 }, 1000)).toBe(0);
    expect(stickyProgress({ top: 0, height: 800 }, 1000)).toBe(1);
  });

  it("slices progress into equal steps", () => {
    expect(stepAt(0, 5)).toBe(0);
    expect(stepAt(0.39, 5)).toBe(1);
    expect(stepAt(0.4, 5)).toBe(2);
    expect(stepAt(1, 5)).toBe(4);
    expect(stepAt(-1, 5)).toBe(0);
  });
});

describe("useStickyProgress", () => {
  it("stays at 0 without an element, even as the page scrolls", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
    const { result, unmount } = renderHook(() => useStickyProgress({ current: null }));
    act(() => {
      window.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(20);
    });
    expect(result.current).toBe(0);
    unmount();
  });
});

describe("cardTransform", () => {
  it("sits the current card square, tips passed ones back and holds upcoming ones below", () => {
    expect(cardTransform(0).opacity).toBe(1);
    expect(cardTransform(-1).transform).toContain("rotateX(14deg)");
    expect(cardTransform(2).transform).toContain("translateY(26%)");
    expect(cardTransform(1).opacity).toBe(0);
  });
});

describe("HowItWorks", () => {
  let top = 0;
  const scrollTo = (value: number): void => {
    top = value;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(20);
    });
  };

  it("brings each step card forward as the section scrolls, filling the rail and playing that step's scene", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return (this.id === "how-it-works" ? { top, height: 1000 * 3.75 } : { top: 0, height: 0, left: 0, width: 0 }) as DOMRect;
    });
    vi.stubGlobal("innerHeight", 1000);
    top = 0;
    const { container } = render(<HowItWorks reducedMotion={false} />);
    const current = (): Element | null => container.querySelector("article[data-current=true]");
    expect(container.querySelectorAll("article")).toHaveLength(JOURNEY_STEPS.length);
    expect(current()).toHaveAttribute("data-actor", "REAL_CITY");
    expect(screen.getByText(/"Street Condition"/)).toBeInTheDocument();
    expect(screen.getByTestId("rail-REAL_DATA").style.transform).toBe("scaleX(0)");

    scrollTo(-700);
    expect(current()?.textContent).toContain("Can we fix it?");
    expect(screen.getAllByText("✓ Serviceable")).toHaveLength(3);
    expect(screen.getByTestId("rail-REAL_DATA").style.transform).toBe("scaleX(1)");

    scrollTo(-1200);
    expect(screen.getByText("Estimated cost")).toBeInTheDocument();
    scrollTo(-1800);
    expect(screen.getByTestId("new-order")).toBeInTheDocument();
    scrollTo(-2750);
    expect(screen.getByText("Resolved")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")[4]).toHaveAttribute("aria-current", "step");
    vi.restoreAllMocks();
  });

  it("shows the estimate's total at once under reduced motion", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return (this.id === "how-it-works" ? { top: -1200, height: 3750 } : { top: 0, height: 0 }) as DOMRect;
    });
    vi.stubGlobal("innerHeight", 1000);
    render(<HowItWorks reducedMotion={true} />);
    expect(screen.getByText("$1,840")).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
