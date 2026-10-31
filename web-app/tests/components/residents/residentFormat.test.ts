import { describe, expect, it } from "vitest";
import { activeHoursLabel, IDEA_TYPE_LABELS, relativeTime, titleCase } from "../../../src/components/residents/residentFormat";
import { IDEA_TYPES } from "../../../src/models/residentIdea";

const NOW = new Date("2026-10-14T12:00:00.000Z");

describe("relativeTime", () => {
  it("reads as just now, minutes, hours or days", () => {
    expect(relativeTime("2026-10-14T11:59:30.000Z", NOW)).toBe("just now");
    expect(relativeTime("2026-10-14T11:48:00.000Z", NOW)).toBe("12m ago");
    expect(relativeTime("2026-10-14T09:00:00.000Z", NOW)).toBe("3h ago");
    expect(relativeTime("2026-10-12T11:00:00.000Z", NOW)).toBe("2d ago");
  });

  it("falls back to just now for a future or unreadable time", () => {
    expect(relativeTime("2026-10-15T00:00:00.000Z", NOW)).toBe("just now");
    expect(relativeTime("not a date", NOW)).toBe("just now");
    expect(relativeTime(new Date().toISOString())).toBe("just now");
  });
});

describe("activeHoursLabel", () => {
  it("pads hours, and shows a window across midnight the same way", () => {
    expect(activeHoursLabel({ start: 5, end: 18 })).toBe("05:00–18:00");
    expect(activeHoursLabel({ start: 21, end: 5 })).toBe("21:00–05:00");
  });
});

describe("titleCase", () => {
  it("title-cases an ALL_CAPS borough", () => {
    expect(titleCase("STATEN ISLAND")).toBe("Staten Island");
  });
});

describe("IDEA_TYPE_LABELS", () => {
  it("has a plain label for every idea type", () => {
    for (const type of IDEA_TYPES) expect(IDEA_TYPE_LABELS[type].length).toBeGreaterThan(0);
  });
});

describe("tool and resolution labels", () => {
  it("labels each tool in the past tense, falling back to its name", async () => {
    const { toolLabel } = await import("../../../src/components/residents/residentFormat");
    expect(toolLabel("SEARCH_REQUESTS")).toBe("Searched requests");
    expect(toolLabel("CREATE_FEATURE_REQUEST")).toBe("Filed a feature request");
    expect(toolLabel("GET_FEATURE_REQUEST")).toBe("Checked a feature request");
    expect(toolLabel("PHONE_CALL")).toBe("PHONE_CALL");
  });

  it("reads an in-progress idea started over an hour ago as stalled", async () => {
    const { resolutionState, RESOLUTION_LABELS } = await import("../../../src/components/residents/residentFormat");
    const { notActionedResolution } = await import("../../../src/models/residentIdea");
    const now = new Date("2026-11-02T12:00:00.000Z");
    const working = { ...notActionedResolution(), status: "IN_PROGRESS" as const, started_at: "2026-11-02T11:30:00.000Z" };
    expect(resolutionState(working, now)).toBe("IN_PROGRESS");
    expect(resolutionState({ ...working, started_at: "2026-11-02T10:30:00.000Z" }, now)).toBe("STALLED");
    expect(resolutionState({ ...working, started_at: null }, now)).toBe("IN_PROGRESS");
    expect(resolutionState(notActionedResolution(), now)).toBe("NOT_ACTIONED");
    expect(RESOLUTION_LABELS.MAX_DEPTH_REACHED).toBe("Hit the limit");
  });

  it("formats durations", async () => {
    const { durationLabel } = await import("../../../src/components/residents/residentFormat");
    expect(durationLabel("2026-11-02T12:00:00.000Z", "2026-11-02T12:00:00.420Z")).toBe("420ms");
    expect(durationLabel("2026-11-02T12:00:00.000Z", "2026-11-02T12:00:04.200Z")).toBe("4.2s");
    expect(durationLabel("2026-11-02T12:00:00.000Z", "2026-11-02T12:03:00.000Z")).toBe("3m");
    expect(durationLabel(null, "x")).toBe("—");
  });
});
