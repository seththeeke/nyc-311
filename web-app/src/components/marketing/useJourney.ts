import { useEffect, useState } from "react";

export interface Journey {
  active: number;
  paused: boolean;
  select: (index: number) => void;
  setPaused: (paused: boolean) => void;
}

/**
 * Which journey step is showing. Auto-advances every `stepMs` while
 * `playing` and not paused (hover/focus), wrapping round; picking a step
 * restarts its timer. Without `playing` (out of view, reduced motion) it holds.
 */
export function useJourney(count: number, stepMs: number, playing: boolean): Journey {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    if (!playing || paused || count < 2) return undefined;
    const timer = window.setTimeout(() => setActive((i) => (i + 1) % count), stepMs);
    return () => window.clearTimeout(timer);
  }, [active, count, stepMs, playing, paused, epoch]);

  const select = (index: number): void => {
    setActive(index);
    setEpoch((e) => e + 1);
  };
  return { active, paused, select, setPaused };
}
