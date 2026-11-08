import { describe, expect, it, vi } from "vitest";
import { canvasPainter, cycle, hash, sprite } from "../../../../web/components/pixel/pixelKit.ts";
import { recorder } from "./recorder.ts";

describe("pixelKit", () => {
  it("paints sprite runs as single rects, skipping transparent pixels, and mirrors when flipped", () => {
    const p = recorder();
    sprite(p, ["AAB.", ".BBB"], { A: "#a", B: "#b" }, 10, 20);
    expect(p.calls).toEqual([
      { x: 10, y: 20, w: 2, h: 1, color: "#a" }, { x: 12, y: 20, w: 1, h: 1, color: "#b" }, { x: 11, y: 21, w: 3, h: 1, color: "#b" },
    ]);
    const flipped = recorder();
    sprite(flipped, ["AB.."], { A: "#a", B: "#b" }, 0, 0, true);
    expect(flipped.calls).toEqual([{ x: 2, y: 0, w: 1, h: 1, color: "#b" }, { x: 3, y: 0, w: 1, h: 1, color: "#a" }]);
  });

  it("paints through a canvas context", () => {
    const ctx = { fillStyle: "", fillRect: vi.fn() };
    canvasPainter(ctx as unknown as CanvasRenderingContext2D).rect(1, 2, 3, 4, "#fff");
    expect(ctx.fillStyle).toBe("#fff");
    expect(ctx.fillRect).toHaveBeenCalledWith(1, 2, 3, 4);
  });

  it("hashes deterministically into [0, 1) and cycles frames", () => {
    expect(hash(3)).toBe(hash(3));
    expect(hash(3)).toBeGreaterThanOrEqual(0);
    expect(hash(3)).toBeLessThan(1);
    expect([0, 1, 2, 3, 4].map((t) => cycle(t, 2))).toEqual([0, 1, 0, 1, 0]);
    expect([0, 1, 2, 3, 4].map((t) => cycle(t, 2, 2))).toEqual([0, 0, 1, 1, 0]);
  });
});
