import { describe, expect, it } from "vitest";
import {
  BURST_SECONDS,
  MAX_PINGS,
  PING_SPAWN_SECONDS,
  TRAIL_LENGTH,
  chooseHeading,
  createCity,
  seededRng,
  stepCity,
  type CityState,
} from "../../../src/components/marketing/cityPulse";

const run = (state: CityState, seconds: number, rng = seededRng(7)): void => {
  for (let t = 0; t < seconds; t += 1 / 30) stepCity(state, 1 / 30, rng);
};

describe("createCity", () => {
  it("covers the viewport diagonal with a whole number of blocks and places trucks on intersections", () => {
    const city = createCity(1200, 800, 5, seededRng(1));
    expect(city.spacing).toBe(57);
    expect(city.half % city.spacing).toBe(0);
    expect(city.half).toBeGreaterThanOrEqual(Math.hypot(1200, 800) / 2);
    expect(city.trucks).toHaveLength(5);
    for (const truck of city.trucks) {
      expect(Math.abs(truck.pos.x % city.spacing)).toBe(0);
      expect(Math.abs(truck.pos.y % city.spacing)).toBe(0);
      expect(Math.abs(truck.heading.x) + Math.abs(truck.heading.y)).toBe(1);
    }
  });

  it("never shrinks a block below 28px on a tiny screen", () => {
    expect(createCity(100, 100, 0, seededRng(1)).spacing).toBe(28);
  });
});

describe("chooseHeading", () => {
  const here = { x: 0, y: 0 };
  const east = { x: 1, y: 0 };

  it("heads along the longer leg toward a target", () => {
    expect(chooseHeading(here, east, { x: -200, y: 50 }, 40, () => 0.9)).toEqual({ x: -1, y: 0 });
    expect(chooseHeading(here, east, { x: 50, y: -200 }, 40, () => 0.9)).toEqual({ x: 0, y: -1 });
  });

  it("finishes the remaining leg once the other is done", () => {
    expect(chooseHeading(here, east, { x: 10, y: 120 }, 40, () => 0.9)).toEqual({ x: 0, y: 1 });
    expect(chooseHeading(here, { x: 0, y: 1 }, { x: 120, y: 10 }, 40, () => 0.9)).toEqual({ x: 1, y: 0 });
  });

  it("keeps going when already at the target", () => {
    expect(chooseHeading(here, east, { x: 5, y: 5 }, 40, () => 0.9)).toEqual(east);
  });

  it("mostly goes straight without a target, and sometimes turns", () => {
    expect(chooseHeading(here, east, null, 40, () => 0.9)).toEqual(east);
    const draws = [0.1, 0.2];
    expect(chooseHeading(here, east, null, 40, () => draws.shift() ?? 0)).toEqual({ x: 0, y: -1 });
    const vertical = [0.1, 0.8];
    expect(chooseHeading(here, { x: 0, y: 1 }, null, 40, () => vertical.shift() ?? 0)).toEqual({ x: 1, y: 0 });
  });
});

describe("stepCity", () => {
  it("spawns calls on its cadence, up to the cap", () => {
    const city = createCity(800, 600, 0, seededRng(2));
    stepCity(city, PING_SPAWN_SECONDS, seededRng(2));
    expect(city.pings).toHaveLength(1);
    run(city, 30);
    expect(city.pings).toHaveLength(MAX_PINGS);
    expect(city.pings.every((p) => p.resolvedAt === null)).toBe(true);
  });

  it("dispatches trucks that resolve calls, keeps trails short and retires finished bursts", () => {
    const city = createCity(800, 600, 6, seededRng(3));
    run(city, 40, seededRng(3));
    expect(city.resolvedCount).toBeGreaterThan(5);
    for (const truck of city.trucks) {
      expect(truck.trail.length).toBeLessThanOrEqual(TRAIL_LENGTH);
      expect(Math.abs(truck.pos.x)).toBeLessThanOrEqual(city.half + city.spacing);
      expect(Math.abs(truck.pos.y)).toBeLessThanOrEqual(city.half + city.spacing);
    }
    for (const ping of city.pings) {
      if (ping.resolvedAt !== null) expect(city.time - ping.resolvedAt).toBeLessThan(BURST_SECONDS);
    }
  });

  it("frees a truck whose call has disappeared", () => {
    const city = createCity(800, 600, 1, seededRng(4));
    city.trucks[0].targetId = 999;
    city.spawnTimer = -100;
    stepCity(city, 0.01, seededRng(4));
    expect(city.trucks[0].targetId).toBeNull();
  });

  it("turns a truck around at the edge of the grid", () => {
    const city = createCity(200, 200, 1, seededRng(5));
    city.spawnTimer = -1000;
    const truck = city.trucks[0];
    truck.pos = { x: city.half - city.spacing, y: 0 };
    truck.heading = { x: 1, y: 0 };
    stepCity(city, city.spacing / truck.speed + 0.001, () => 0.99);
    expect(truck.heading).toEqual({ x: -1, y: 0 });
  });
});

describe("seededRng", () => {
  it("is reproducible and stays in [0, 1)", () => {
    const a = seededRng(42);
    const b = seededRng(42);
    for (let i = 0; i < 50; i += 1) {
      const value = a();
      expect(value).toBe(b());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
