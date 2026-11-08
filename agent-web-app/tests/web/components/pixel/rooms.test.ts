import { describe, expect, it } from "vitest";
import { ROOM_W, type RoomState } from "../../../../web/components/pixel/pixelKit.ts";
import { ROSTER_ORDER, personaFor } from "../../../../web/components/pixel/personas.ts";
import { recorder } from "./recorder.ts";

const STATES: RoomState[] = ["IDLE", "WORKING", "ASLEEP", "ALERT"];
const AGENTS = [...ROSTER_ORDER, "someone-new"];

describe("rooms", () => {
  it.each(AGENTS)("%s: draws every state, at every hour, over a minute of frames", (agent) => {
    const { draw } = personaFor(agent);
    for (const state of STATES) {
      for (const hour of [2, 6, 12, 19]) {
        for (let t = 0; t < 64; t++) {
          const p = recorder();
          draw(p, { t, state, hour });
          expect(p.calls.length).toBeGreaterThan(40);
          for (const c of p.calls) expect(Number.isFinite(c.x + c.y + c.w + c.h)).toBe(true);
        }
      }
    }
  });

  it("paints the whole room, edge to edge", () => {
    for (const agent of AGENTS) {
      const p = recorder();
      personaFor(agent).draw(p, { t: 0, state: "IDLE", hour: 12 });
      expect(p.calls.some((c) => c.x <= 0 && c.x + c.w >= ROOM_W)).toBe(true);
    }
  });
});
