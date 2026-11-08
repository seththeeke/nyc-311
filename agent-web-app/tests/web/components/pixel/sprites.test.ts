import { describe, expect, it } from "vitest";
import { drawCharacter, type CharacterSprite } from "../../../../web/components/pixel/sprites/character.ts";
import { BROGAN } from "../../../../web/components/pixel/sprites/brogan.ts";
import { CELESTINE } from "../../../../web/components/pixel/sprites/celestine.ts";
import { GRIMBLE } from "../../../../web/components/pixel/sprites/grimble.ts";
import { KESTREL } from "../../../../web/components/pixel/sprites/kestrel.ts";
import { PENNY } from "../../../../web/components/pixel/sprites/penny.ts";
import { PIP } from "../../../../web/components/pixel/sprites/pip.ts";
import { REX } from "../../../../web/components/pixel/sprites/rex.ts";
import { ROBOT } from "../../../../web/components/pixel/sprites/robot.ts";
import { SABLE } from "../../../../web/components/pixel/sprites/sable.ts";
import { recorder } from "./recorder.ts";

const ALL: Record<string, CharacterSprite> = { BROGAN, CELESTINE, GRIMBLE, KESTREL, PENNY, PIP, REX, ROBOT, SABLE };

describe("character sprites", () => {
  it.each(Object.entries(ALL))("%s: every frame is 16 wide, as tall as idle, and uses only palette colours", (_, c) => {
    for (const frame of [c.idle, ...c.work]) {
      expect(frame).toHaveLength(c.idle.length);
      for (const row of frame) {
        expect(row).toHaveLength(16);
        for (const ch of row) if (ch !== ".") expect(c.palette).toHaveProperty(ch);
      }
    }
    for (const [x, y] of c.eyes) expect(c.idle[y][x]).not.toBe(".");
  });
});

describe("drawCharacter", () => {
  const lidCalls = (state: "IDLE" | "ASLEEP" | "WORKING" | "ALERT", t: number, flip = false) => {
    const p = recorder();
    drawCharacter(p, PIP, 0, 0, { state, t, hour: 12 }, flip);
    return p.calls.filter((c) => c.color === PIP.lid && c.w === 1 && c.h === 1);
  };

  it("closes the eyes asleep and on an idle blink, never while working or on alert", () => {
    expect(lidCalls("ASLEEP", 3)).toHaveLength(2);
    expect(lidCalls("IDLE", 0)).toHaveLength(2);
    expect(lidCalls("IDLE", 3)).toHaveLength(0);
    expect(lidCalls("WORKING", 0)).toHaveLength(0);
    expect(lidCalls("ALERT", 0)).toHaveLength(0);
  });

  it("mirrors the eyes with the sprite", () => {
    expect(lidCalls("ASLEEP", 0, true).map((c) => c.x)).toEqual([15 - 6, 15 - 10]);
  });

  it("loops the work frames", () => {
    const frames = [0, 2].map((t) => {
      const p = recorder();
      drawCharacter(p, PIP, 0, 0, { state: "WORKING", t, hour: 12 });
      return JSON.stringify(p.calls);
    });
    expect(frames[0]).not.toBe(frames[1]);
  });
});
