import { useEffect, useState, type RefObject } from "react";

/**
 * How far a tall section has been scrolled through while its sticky child is
 * pinned: 0 as the section's top meets the viewport top, 1 as its bottom meets
 * the viewport bottom.
 */
export function stickyProgress(rect: { top: number; height: number }, viewportHeight: number): number {
  const travel = rect.height - viewportHeight;
  if (travel <= 0) return rect.top <= 0 ? 1 : 0;
  return Math.min(1, Math.max(0, -rect.top / travel));
}

/** The step a progress value lands on, out of `count` equal slices. */
export function stepAt(progress: number, count: number): number {
  return Math.min(count - 1, Math.max(0, Math.floor(progress * count)));
}

/*
 * `ref`'s sticky progress, updated on any scroll in the page. The capture
 * listener catches scrolling inside the marketing page's own scroll
 * container, not just the window; updates are batched to animation frames.
 */
export function useStickyProgress(ref: RefObject<Element | null>): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const measure = (): void => {
      const element = ref.current;
      if (element) setProgress(stickyProgress(element.getBoundingClientRect(), window.innerHeight));
    };
    const onScroll = (): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
    };
  }, [ref]);

  return progress;
}
