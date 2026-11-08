import type { Painter } from "../../../../web/components/pixel/pixelKit.ts";

/** A Painter that records every rect, for asserting what a room drew without a canvas. */
export function recorder(): Painter & { calls: { x: number; y: number; w: number; h: number; color: string }[] } {
  const calls: { x: number; y: number; w: number; h: number; color: string }[] = [];
  return { calls, rect: (x, y, w, h, color) => void calls.push({ x, y, w, h, color }) };
}
