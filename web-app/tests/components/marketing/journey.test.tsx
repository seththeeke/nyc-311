import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HowItWorks } from "../../../src/components/marketing/HowItWorks";
import { JOURNEY_STEPS } from "../../../src/components/marketing/journeySteps";
import { useJourney } from "../../../src/components/marketing/useJourney";
import { useTicker } from "../../../src/components/marketing/useTicker";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useJourney", () => {
  it("advances on its timer and wraps round", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useJourney(3, 100, true));
    expect(result.current.active).toBe(0);
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.active).toBe(1);
    act(() => vi.advanceTimersByTime(100));
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.active).toBe(0);
  });

  it("holds while paused or not playing, and a pick restarts the timer", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ playing }) => useJourney(3, 100, playing), { initialProps: { playing: false } });
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.active).toBe(0);
    rerender({ playing: true });
    act(() => result.current.setPaused(true));
    expect(result.current.paused).toBe(true);
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.active).toBe(0);
    act(() => {
      result.current.setPaused(false);
      result.current.select(2);
    });
    expect(result.current.active).toBe(2);
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.active).toBe(0);
  });

  it("never advances a single step", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useJourney(1, 100, true));
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.active).toBe(0);
  });
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

describe("HowItWorks", () => {
  it("lists every step as a tab, marks the real-data step, and plays each scene when picked", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<HowItWorks reducedMotion={false} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(JOURNEY_STEPS.length);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("data-actor", "REAL_CITY");
    expect(screen.getByText("Real data", { selector: "span.rounded-full" })).toBeInTheDocument();
    expect(screen.getByText(/"Street Condition"/)).toBeInTheDocument();

    await userEvent.click(tabs[1]);
    expect(screen.getByRole("tabpanel")).toHaveAttribute("data-actor", "BOROUGHSIM");
    expect(screen.getAllByText("✓ Serviceable")).toHaveLength(3);
    expect(screen.getByText("BoroughSim doesn't")).toBeInTheDocument();

    await userEvent.click(tabs[2]);
    expect(screen.getByText("Estimated cost")).toBeInTheDocument();

    await userEvent.click(tabs[3]);
    expect(screen.getByTestId("new-order")).toBeInTheDocument();

    await userEvent.click(tabs[4]);
    expect(screen.getByText("Resolved")).toBeInTheDocument();
  });

  it("pauses its progress bar under the pointer and auto-advances otherwise", () => {
    vi.useFakeTimers();
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = render(<HowItWorks reducedMotion={false} />);
    const bar = (): Element | null => container.querySelector("[role=tab][aria-selected=true] span[style*='animation-duration']");
    expect(bar()).not.toBeNull();
    const grid = screen.getByRole("tablist").parentElement as HTMLElement;
    fireEvent.pointerEnter(grid);
    expect(bar()).toBeNull();
    act(() => vi.advanceTimersByTime(9000));
    expect(screen.getAllByRole("tab")[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.pointerLeave(grid);
    act(() => vi.advanceTimersByTime(6000));
    expect(screen.getAllByRole("tab")[1]).toHaveAttribute("aria-selected", "true");
  });

  it("holds still with reduced motion: no progress bar, and the estimate shows its total at once", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = render(<HowItWorks reducedMotion={true} />);
    expect(container.querySelector("span[style*='animation-duration']")).toBeNull();
    await userEvent.click(screen.getAllByRole("tab")[2]);
    expect(screen.getByText("$1,840")).toBeInTheDocument();
  });
});
