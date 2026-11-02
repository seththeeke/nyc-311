import { useEffect, useState, type RefObject } from "react";

/**
 * True once `ref`'s element has scrolled into view, and stays true, so a
 * reveal plays once. Without IntersectionObserver everything is in view.
 */
export function useInView(ref: RefObject<Element | null>, threshold = 0.2): boolean {
  const [inView, setInView] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const element = ref.current;
    if (inView || !element || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setInView(true);
      },
      { threshold },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, threshold, inView]);

  return inView;
}
