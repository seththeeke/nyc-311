import { describe, expect, it } from "vitest";
import { bricks, checker, disc, gear, lightsOff, line, moodBubble, planks, skyColors, skyWindow, statusLamp } from "../../../../web/components/pixel/scenery.ts";
import type { RoomState } from "../../../../web/components/pixel/pixelKit.ts";
import { recorder } from "./recorder.ts";

const STATES: RoomState[] = ["IDLE", "WORKING", "ASLEEP", "ALERT"];

describe("scenery", () => {
  it("colours the sky by hour", () => {
    expect(skyColors(2).night).toBe(true);
    expect(skyColors(22).night).toBe(true);
    expect(skyColors(6).top).toBe("#f4a582");
    expect(skyColors(12).top).toBe("#5fa8e8");
    expect(skyColors(19).top).toBe("#3b2a5c");
  });

  it("adds stars to a window only at night", () => {
    const night = recorder();
    skyWindow(night, 0, 0, 10, 10, 23);
    const day = recorder();
    skyWindow(day, 0, 0, 10, 10, 12);
    expect(night.calls.length - day.calls.length).toBe(6);
  });

  it("draws floors, walls, discs, lines and gears", () => {
    const p = recorder();
    planks(p, 0, 20, "#a", "#b");
    bricks(p, 0, 20, "#a", "#b");
    checker(p, 0, 16, "#a", "#b");
    disc(p, 10, 10, 3, "#c");
    line(p, 0, 0, 10, 4, "#d");
    line(p, 5, 5, 5, 5, "#d");
    gear(p, 20, 20, 5, "#e", "#f", 3, true);
    gear(p, 20, 20, 5, "#e", "#f", 3, false, 6);
    expect(p.calls.filter((c) => c.color === "#d")).toHaveLength(12);
    expect(p.calls.length).toBeGreaterThan(50);
  });

  it("draws a half-length line when asked", () => {
    const p = recorder();
    line(p, 0, 0, 10, 0, "#d", 0.5);
    expect(p.calls).toHaveLength(6);
  });

  it("shows a bubble, lamp and lights for every state over time", () => {
    for (const state of STATES) {
      for (let t = 0; t < 30; t++) {
        const p = recorder();
        moodBubble(p, 20, 3, state, t);
        statusLamp(p, 10, 10, state, t);
        lightsOff(p, state);
        if (state === "IDLE") expect(p.calls.every((c) => c.color !== "#f8f8f8")).toBe(true);
      }
    }
    const asleep = recorder();
    lightsOff(asleep, "ASLEEP");
    expect(asleep.calls).toHaveLength(1);
  });
});
