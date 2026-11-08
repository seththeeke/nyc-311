import { describe, expect, it } from "vitest";
import { runIdToIso, stampToIso } from "../../../server/source/localTime.ts";
import { local } from "../fixtures.ts";

describe("localTime", () => {
  it("reads run ids and log stamps as local time", () => {
    expect(runIdToIso("20261107T140004")).toBe(local(2026, 11, 7, 14, 0, 4));
    expect(stampToIso("2026-11-07 14:00:04")).toBe(local(2026, 11, 7, 14, 0, 4));
  });

  it("returns null for malformed input", () => {
    expect(runIdToIso("2026-11-07")).toBeNull();
    expect(stampToIso("20261107T140004")).toBeNull();
  });
});
