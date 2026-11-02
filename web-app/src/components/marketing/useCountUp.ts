import { useEffect, useState } from "react";

/* easeOutExpo: fast off the line, a long settle, the classic stat-counter feel. */
export function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/**
 * Counts from 0 to `target` over `durationMs` once `active` turns true.
 * A null target stays null, and `instant` skips the animation (reduced motion).
 */
export function useCountUp(target: number | null, active: boolean, durationMs: number, instant: boolean): number | null {
  const [value, setValue] = useState<number | null>(target === null ? null : 0);

  useEffect(() => {
    if (target === null) {
      setValue(null);
      return undefined;
    }
    if (!active) return undefined;
    if (instant) {
      setValue(target);
      return undefined;
    }
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number): void => {
      start ??= now;
      const t = Math.min(1, (now - start) / durationMs);
      setValue(target * easeOutExpo(t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, active, durationMs, instant]);

  return value;
}
