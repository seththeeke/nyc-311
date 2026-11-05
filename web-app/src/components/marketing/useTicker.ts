import { useEffect, useState } from "react";

/* A count that goes up by one every `ms` while `playing`, and never wraps, so a rotation built on it only ever turns forward. */
export function useTicker(ms: number, playing: boolean): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => setTick((t) => t + 1), ms);
    return () => window.clearInterval(timer);
  }, [ms, playing]);
  return tick;
}
