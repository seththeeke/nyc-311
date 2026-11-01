import { describe, expect, it } from "vitest";
import { clockTime, meetingDay } from "../../../src/components/team/teamFormat";

describe("teamFormat", () => {
  it("formats times and dates", () => {
    expect(clockTime("2026-10-31T08:04:00.000Z")).toBe("08:04");
    expect(meetingDay("2026-10-31")).toBe("Sat, Oct 31");
  });
});
