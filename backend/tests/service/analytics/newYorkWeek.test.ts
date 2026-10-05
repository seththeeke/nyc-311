import { describe, expect, it } from "vitest";
import { addDays, newYorkDate, weekStartOf, weekToDateDays } from "../../../service/analytics/newYorkWeek";

describe("newYorkDate", () => {
  it("maps a UTC instant to the New York calendar date, during daylight time (UTC-4)", () => {
    expect(newYorkDate(new Date("2026-10-05T03:59:59.000Z"))).toBe("2026-10-04");
    expect(newYorkDate(new Date("2026-10-05T04:00:00.000Z"))).toBe("2026-10-05");
  });

  it("uses standard time (UTC-5) once daylight time ends", () => {
    expect(newYorkDate(new Date("2026-12-07T04:59:59.000Z"))).toBe("2026-12-06");
    expect(newYorkDate(new Date("2026-12-07T05:00:00.000Z"))).toBe("2026-12-07");
  });
});

describe("addDays", () => {
  it("steps forward and back across month and year boundaries", () => {
    expect(addDays("2026-10-05", -7)).toBe("2026-09-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-10-05", 0)).toBe("2026-10-05");
  });
});

describe("weekStartOf", () => {
  it("returns the same day for a Monday", () => {
    expect(weekStartOf("2026-10-05")).toBe("2026-10-05");
  });

  it("returns the preceding Monday for a Sunday — the week's last day, not its first", () => {
    expect(weekStartOf("2026-10-04")).toBe("2026-09-28");
  });

  it("returns that week's Monday for a midweek day", () => {
    expect(weekStartOf("2026-10-08")).toBe("2026-10-05");
  });
});

describe("weekToDateDays", () => {
  it("is just Monday on a Monday", () => {
    expect(weekToDateDays("2026-10-05", "2026-10-05")).toEqual(["2026-10-05"]);
  });

  it("lists all seven days by Sunday, across the fall-back DST change", () => {
    expect(weekToDateDays("2026-10-26", "2026-11-01")).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
  });
});
