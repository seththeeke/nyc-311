import { describe, expect, it } from "vitest";
import {
  formatAbsoluteDateTime,
  formatCompactNumber,
  formatRelativeTime,
  niceMax,
} from "../../../src/components/ingestion/formatters";

describe("formatCompactNumber", () => {
  it("comma-formats values under 10,000", () => {
    expect(formatCompactNumber(1284)).toBe("1,284");
    expect(formatCompactNumber(0)).toBe("0");
  });

  it("compacts values at or above 10,000", () => {
    expect(formatCompactNumber(12_900)).toBe("12.9K");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-08-15T12:00:00.000Z");

  it("formats minutes for a recent past time", () => {
    expect(formatRelativeTime("2026-08-15T11:45:00.000Z", now)).toBe("15 minutes ago");
  });

  it("formats hours for a time within the last day", () => {
    expect(formatRelativeTime("2026-08-15T06:00:00.000Z", now)).toBe("6 hours ago");
  });

  it("formats days for a time more than a day ago", () => {
    expect(formatRelativeTime("2026-08-13T12:00:00.000Z", now)).toBe("2 days ago");
  });

  it("formats a future time", () => {
    expect(formatRelativeTime("2026-08-15T12:30:00.000Z", now)).toBe("in 30 minutes");
  });
});

describe("formatAbsoluteDateTime", () => {
  it("returns a non-empty formatted date string", () => {
    expect(formatAbsoluteDateTime("2026-08-15T15:12:43.894Z").length).toBeGreaterThan(0);
  });
});

describe("niceMax", () => {
  it("returns a fallback for zero or negative input", () => {
    expect(niceMax(0)).toBe(10);
    expect(niceMax(-5)).toBe(10);
  });

  it("rounds up to the nearest clean step", () => {
    expect(niceMax(2003)).toBe(2500);
    expect(niceMax(47)).toBe(50);
    expect(niceMax(118)).toBe(250);
  });

  it("returns the exact value when it's already a clean step", () => {
    expect(niceMax(100)).toBe(100);
  });

  it("steps up to 10x magnitude for a value past the 5x step", () => {
    expect(niceMax(9500)).toBe(10_000);
  });
});
