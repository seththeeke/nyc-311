import { describe, expect, it } from "vitest";
import {
  formatCount,
  formatCurrency,
  formatHours,
  formatWeekDelta,
  formatWeekLabel,
} from "../../../src/components/widgets/workspaceMetricFormat";

describe("formatHours", () => {
  it.each([
    [0.95, "57m"],
    [1.02, "1h 01m"],
    [5.28, "5h 17m"],
    [2.999, "3h 00m"],
    [23.999, "1d 0h"],
    [115.42, "4d 19h"],
    [332.65, "13d 21h"],
    [47.8, "2d 0h"],
  ])("%s hours → %s", (hours, expected) => {
    expect(formatHours(hours)).toBe(expected);
  });
});

describe("formatCount", () => {
  it("groups thousands", () => {
    expect(formatCount(187652)).toBe("187,652");
  });
});

describe("formatCurrency", () => {
  it("formats whole dollars", () => {
    expect(formatCurrency(421380.4)).toBe("$421,380");
  });
});

describe("formatWeekDelta", () => {
  it("shows an arrow and a rounded percent against the prior week", () => {
    expect(formatWeekDelta(411, 832)).toBe("↓ 51% vs. last week");
    expect(formatWeekDelta(832, 290)).toBe("↑ 187% vs. last week");
  });

  it("says no change when the rounded percent is 0", () => {
    expect(formatWeekDelta(1000, 1001)).toBe("no change vs. last week");
  });

  it("has nothing to compare against with no prior week, or a prior week of 0", () => {
    expect(formatWeekDelta(5, null)).toBeNull();
    expect(formatWeekDelta(290, 0)).toBeNull();
  });
});

describe("formatWeekLabel", () => {
  it("formats an ISO date as month + day, in UTC", () => {
    expect(formatWeekLabel("2026-09-21")).toBe("Sep 21");
  });
});
