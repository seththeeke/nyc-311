import { type RefObject, useEffect, useState } from "react";

export interface InView {
  /* On screen right now. */
  inView: boolean;
  /* Has been on screen at least once: for reveal-on-scroll that plays only the first time. */
  seen: boolean;
}

/**
 * Watches `ref` scroll in and out of view (#146). Without
 * IntersectionObserver it reports the element as in view, so nothing
 * stays hidden.
 */
export function useInView(ref: RefObject<Element | null>, threshold = 0.15): InView {
  const [state, setState] = useState<InView>({ inView: false, seen: false });
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      setState({ inView: true, seen: true });
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setState((current) => ({ inView: entry.isIntersecting, seen: current.seen || entry.isIntersecting })),
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, threshold]);
  return state;
}
