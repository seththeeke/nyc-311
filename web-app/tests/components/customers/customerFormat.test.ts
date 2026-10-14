import { describe, expect, it } from "vitest";
import { activeHoursLabel, avatarClasses, IDEA_TYPE_STYLES, relativeTime, titleCase } from "../../../src/components/customers/customerFormat";
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
  it("pads hours and marks a window that runs overnight", () => {
    expect(activeHoursLabel({ start: 5, end: 18 })).toBe("05:00–18:00");
    expect(activeHoursLabel({ start: 21, end: 5 })).toBe("21:00–05:00 (overnight)");
  });
});

describe("titleCase", () => {
  it("title-cases an ALL_CAPS borough", () => {
    expect(titleCase("STATEN ISLAND")).toBe("Staten Island");
  });
});

describe("styles", () => {
  it("has a label for every idea type, and a stable avatar colour per persona", () => {
    for (const type of IDEA_TYPES) expect(IDEA_TYPE_STYLES[type].label.length).toBeGreaterThan(0);
    expect(avatarClasses("hawthorn")).toBe(avatarClasses("hawthorn"));
    const launchColours = new Set(["hawthorn", "sycamore", "juniper"].map(avatarClasses));
    expect(launchColours.size).toBe(3);
  });
});
