import { describe, expect, it } from "vitest";
import {
  formatAbsoluteDateTime,
  formatDuration,
  formatDurationSeconds,
  formatRelativeTime,
} from "../../../src/components/pipeline/formatters";

describe("formatRelativeTime", () => {
  const now = new Date("2026-08-16T12:00:00.000Z");

  it("formats minutes for a recent past time", () => {
    expect(formatRelativeTime("2026-08-16T11:45:00.000Z", now)).toBe("15 minutes ago");
  });

  it("formats hours for a time within the last day", () => {
    expect(formatRelativeTime("2026-08-16T06:00:00.000Z", now)).toBe("6 hours ago");
  });

  it("formats days for a time more than a day ago", () => {
    expect(formatRelativeTime("2026-08-14T12:00:00.000Z", now)).toBe("2 days ago");
  });
});

describe("formatAbsoluteDateTime", () => {
  it("returns a non-empty formatted date string", () => {
    expect(formatAbsoluteDateTime("2026-08-16T15:12:43.894Z").length).toBeGreaterThan(0);
  });
});

describe("formatDuration", () => {
  const now = new Date("2026-08-16T12:10:00.000Z");

  it("formats seconds only under a minute", () => {
    expect(formatDuration("2026-08-16T12:00:00.000Z", "2026-08-16T12:00:45.000Z")).toBe("45s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration("2026-08-16T12:00:00.000Z", "2026-08-16T12:04:12.000Z")).toBe("4m 12s");
  });

  it("measures up to `now` when endIso is null (still running)", () => {
    expect(formatDuration("2026-08-16T12:08:00.000Z", null, now)).toBe("2m 0s");
  });

  it("never returns a negative duration", () => {
    expect(formatDuration("2026-08-16T12:05:00.000Z", "2026-08-16T12:04:00.000Z")).toBe("0s");
  });
});

describe("formatDurationSeconds", () => {
  it("formats seconds only under a minute", () => {
    expect(formatDurationSeconds(45)).toBe("45s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDurationSeconds(318)).toBe("5m 18s");
  });

  it("rounds a fractional seconds value", () => {
    expect(formatDurationSeconds(45.6)).toBe("46s");
  });

  it("never returns a negative duration", () => {
    expect(formatDurationSeconds(-5)).toBe("0s");
  });
});
