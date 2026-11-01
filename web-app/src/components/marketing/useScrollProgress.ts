import { useEffect, useState, type RefObject } from "react";

/** How far through the viewport `rect` has travelled: 0 as its top enters the bottom edge, 1 once its middle reaches the centre. */
export function scrollProgress(rect: { top: number; height: number }, viewportHeight: number): number {
  const start = viewportHeight;
  const end = viewportHeight / 2 - rect.height / 2;
  if (start === end) return 1;
  return Math.min(1, Math.max(0, (start - rect.top) / (start - end)));
}

/**
 * `ref`'s scroll progress (see `scrollProgress`), updated on any scroll in
 * the page. The capture listener catches scrolling inside the marketing
 * page's own scroll container, not just the window.
 */
export function useScrollProgress(ref: RefObject<Element | null>): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const measure = (): void => {
      const element = ref.current;
      if (element) setProgress(scrollProgress(element.getBoundingClientRect(), window.innerHeight));
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
