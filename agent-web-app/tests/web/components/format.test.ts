import { describe, expect, it } from "vitest";
import { formatDuration, formatElapsed, formatSlot, formatWhen } from "../../../web/components/format.ts";

const now = new Date(2026, 10, 7, 15, 0);

describe("format", () => {
  it("formats times relative to now", () => {
    expect(formatWhen(null)).toBe("—");
    expect(formatWhen(new Date(2026, 10, 7, 9, 5).toISOString(), now)).toBe("today 09:05");
    expect(formatWhen(new Date(2026, 10, 5, 9, 5).toISOString(), now)).toMatch(/^\w{3} 09:05$/);
    expect(formatWhen(new Date(2026, 9, 1, 9, 5).toISOString(), now)).toMatch(/1.* 09:05$/);
  });

  it("formats durations and elapsed time", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(42)).toBe("42s");
    expect(formatDuration(108)).toBe("1m 48s");
    expect(formatElapsed(new Date(2026, 10, 7, 14, 58).toISOString(), now)).toBe("2m 0s");
    expect(formatElapsed(new Date(2026, 10, 7, 16, 0).toISOString(), now)).toBe("0s");
    expect(formatElapsed(new Date().toISOString())).toMatch(/s$/);
  });

  it("formats schedule slots", () => {
    expect(formatSlot({ day: "Mon", time: "21:30", mode: "DAILY" })).toBe("Mon 21:30 DAILY");
    expect(formatSlot({ day: null, time: "08:00", mode: null })).toBe("08:00");
  });
});
