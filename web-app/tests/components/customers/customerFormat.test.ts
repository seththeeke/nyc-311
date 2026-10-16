import { describe, expect, it } from "vitest";
import { activeHoursLabel, IDEA_TYPE_LABELS, relativeTime, titleCase } from "../../../src/components/customers/customerFormat";
import { IDEA_TYPES } from "../../../src/models/customerIdea";

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

describe("action labels and clock time", () => {
  it("labels every action in the past tense, and formats seconds as m:ss", async () => {
    const { ACTION_TYPE_LABELS, NOT_ACTIONED_LABEL, clockTime } = await import("../../../src/components/customers/customerFormat");
    expect(Object.values(ACTION_TYPE_LABELS)).toEqual(["Requested a feature", "Checked status via API", "Browsed the website"]);
    expect(NOT_ACTIONED_LABEL).toBe("Not actioned yet");
    expect(clockTime(0)).toBe("0:00");
    expect(clockTime(65.9)).toBe("1:05");
  });
});
