import { describe, expect, it } from "vitest";
import type { ScorecardEntry } from "../../../src/models/staffMeeting";
import { clockTime, formatMetric, meetingDay, metricTrend, minutesBetween, onTarget } from "../../../src/components/team/teamFormat";

const entry = (overrides: Partial<ScorecardEntry>): ScorecardEntry => ({
  metric: "ON_TIME_RATE",
  label: "On-time orders",
  unit: "PERCENT",
  value: 96,
  previous: 93,
  target: 95,
  better: "UP",
  ...overrides,
});

describe("teamFormat", () => {
  it("formats each unit", () => {
    expect(formatMetric(96.14, "PERCENT")).toBe("96.1%");
    expect(formatMetric(43.2, "USD")).toBe("$43.20");
    expect(formatMetric(41, "COUNT")).toBe("41");
  });

  it("calls a move better or worse by the metric's good direction, and flat with no change or no history", () => {
    expect(metricTrend(entry({}))).toBe("BETTER");
    expect(metricTrend(entry({ value: 90 }))).toBe("WORSE");
    expect(metricTrend(entry({ better: "DOWN", value: 30, previous: 40 }))).toBe("BETTER");
    expect(metricTrend(entry({ better: "DOWN", value: 50, previous: 40 }))).toBe("WORSE");
    expect(metricTrend(entry({ previous: null }))).toBe("FLAT");
    expect(metricTrend(entry({ previous: 96 }))).toBe("FLAT");
  });

  it("checks the target in the metric's direction", () => {
    expect(onTarget(entry({}))).toBe(true);
    expect(onTarget(entry({ value: 94 }))).toBe(false);
    expect(onTarget(entry({ better: "DOWN", value: 38, target: 38 }))).toBe(true);
    expect(onTarget(entry({ better: "DOWN", value: 43, target: 38 }))).toBe(false);
  });

  it("formats times and dates", () => {
    expect(clockTime("2026-10-31T12:04:00.000Z")).toBe("12:04");
    expect(meetingDay("2026-10-31")).toBe("Sat, Oct 31");
    expect(minutesBetween("2026-10-31T12:00:00.000Z", "2026-10-31T12:18:00.000Z")).toBe(18);
  });
});
