import { describe, expect, it } from "vitest";
import { createCity, seededRng, stepCity } from "../../../src/components/marketing/cityPulse";
import { readPalette, renderCity } from "../../../src/components/marketing/cityPulseRender";
import { fakeContext2d } from "./fakeCanvas";

describe("readPalette", () => {
  it("reads the theme's hue tokens", () => {
    const root = document.createElement("div");
    root.style.setProperty("--t-hue-cyan", "#00ffff");
    document.body.appendChild(root);
    expect(readPalette(root).truck).toBe("#00ffff");
    root.remove();
  });

  it("falls back to the dark palette when tokens are unset", () => {
    const palette = readPalette(document.createElement("div"));
    expect(palette.ping).toBe("#fcd34d");
    expect(palette.resolved).toBe("#6ee7b7");
  });
});

describe("renderCity", () => {
  const palette = readPalette(document.createElement("div"));

  it("draws the grid, open and resolved calls and trucks, tilted about the centre", () => {
    const city = createCity(800, 600, 4, seededRng(9));
    const rng = seededRng(9);
    for (let t = 0; t < 20; t += 1 / 30) stepCity(city, 1 / 30, rng);
    expect(city.pings.some((p) => p.resolvedAt === null)).toBe(true);
    city.pings.push({ id: 9999, pos: { x: 0, y: 0 }, bornAt: 0, resolvedAt: city.time });
    const ctx = fakeContext2d();
    renderCity(ctx, city, palette, { width: 800, height: 600 }, null);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
    expect(ctx.rotate).toHaveBeenCalledWith(expect.closeTo(-0.506, 2));
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.createRadialGradient).not.toHaveBeenCalled();
  });

  it("lights the grid under the pointer", () => {
    const ctx = fakeContext2d();
    renderCity(ctx, createCity(400, 400, 0, seededRng(1)), palette, { width: 400, height: 400 }, { x: 100, y: 120 });
    expect(ctx.createRadialGradient).toHaveBeenCalledWith(100, 120, 0, 100, 120, 140);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 400, 400);
  });
});
