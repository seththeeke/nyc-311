import { describe, expect, it } from "vitest";
import { nextFire, previousFire, slotKey } from "../../../server/service/scheduleService.ts";
import { local } from "../fixtures.ts";

const daily = (time: string) => ({ day: null, time, mode: null });
/* 2026-11-07 is a Saturday. */
const now = new Date(local(2026, 11, 7, 10, 0));

describe("scheduleService", () => {
  it("keys a slot without its mode", () => {
    expect(slotKey({ day: "Mon", time: "21:30" })).toBe("Mon@21:30");
    expect(slotKey({ day: null, time: "08:00" })).toBe("08:00");
  });

  it("finds the next fire today, tomorrow, or on the slot's weekday", () => {
    expect(nextFire([daily("08:00"), daily("14:00")], now)).toBe(local(2026, 11, 7, 14, 0));
    expect(nextFire([daily("08:00")], now)).toBe(local(2026, 11, 8, 8, 0));
    expect(nextFire([{ day: "Mon", time: "21:30", mode: null }], now)).toBe(local(2026, 11, 9, 21, 30));
    expect(nextFire([{ day: "Sat", time: "09:00", mode: null }], now)).toBe(local(2026, 11, 14, 9, 0));
    expect(nextFire([], now)).toBeNull();
  });

  it("finds the previous fire today, yesterday, or on the slot's weekday", () => {
    expect(previousFire([daily("08:00"), daily("14:00")], now)).toBe(local(2026, 11, 7, 8, 0));
    expect(previousFire([daily("14:00")], now)).toBe(local(2026, 11, 6, 14, 0));
    expect(previousFire([{ day: "Mon", time: "21:30", mode: null }], now)).toBe(local(2026, 11, 2, 21, 30));
    expect(previousFire([{ day: "Sat", time: "11:00", mode: null }], now)).toBe(local(2026, 10, 31, 11, 0));
    expect(previousFire([], now)).toBeNull();
  });
});
