import { describe, expect, it } from "vitest";
import { formatAbsoluteDateTime, formatBytes, formatDuration, formatMillis } from "../../../src/components/data/formatters";

describe("formatAbsoluteDateTime", () => {
  it("returns a non-empty formatted date string", () => {
    expect(formatAbsoluteDateTime("2026-09-04T09:00:01.000Z").length).toBeGreaterThan(0);
  });
});

describe("formatDuration", () => {
  const now = new Date("2026-09-05T09:10:00.000Z");

  it("formats seconds only under a minute", () => {
    expect(formatDuration("2026-09-04T09:00:00.000Z", "2026-09-04T09:00:14.000Z")).toBe("14s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration("2026-09-02T16:04:00.000Z", "2026-09-02T16:11:32.000Z")).toBe("7m 32s");
  });

  it("measures up to `now` when endIso is null (still running)", () => {
    expect(formatDuration("2026-09-05T09:08:00.000Z", null, now)).toBe("2m 0s");
  });

  it("never returns a negative duration", () => {
    expect(formatDuration("2026-09-05T09:05:00.000Z", "2026-09-05T09:04:00.000Z")).toBe("0s");
  });
});

describe("formatBytes", () => {
  it("formats bytes under 1024 as B", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(2_048)).toBe("2.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(4_213_888)).toBe("4.0 MB");
  });
});

describe("formatMillis", () => {
  it("formats sub-second durations as milliseconds", () => {
    expect(formatMillis(96)).toBe("96 ms");
  });

  it("formats durations of a second or more as seconds", () => {
    expect(formatMillis(1_842)).toBe("1.84s");
  });
});
