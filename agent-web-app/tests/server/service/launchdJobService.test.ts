import { describe, expect, it } from "vitest";
import { toLaunchdJob } from "../../../server/service/launchdJobService.ts";
import { ALPHA_PLIST_JSON, fixtureText } from "../fixtures.ts";

describe("toLaunchdJob", () => {
  it("combines an installed, loaded job", () => {
    const job = toLaunchdJob("/p.plist", JSON.parse(ALPHA_PLIST_JSON), fixtureText("launchctlPrint.txt"));
    expect(job).toMatchObject({ installed: true, loaded: true, state: "not running", lastExitCode: 0, runs: 7, plistSlots: ["05:00", "14:00", "Mon@21:30"] });
    expect(job.scriptPath).toMatch(/agent-scheduled-run\.sh$/);
  });

  it("handles a single calendar entry, missing keys and a not-loaded job", () => {
    const job = toLaunchdJob("/p.plist", { ProgramArguments: ["/bin/sh", "/x/run.sh"], StartCalendarInterval: { Weekday: 7 } }, null);
    expect(job).toMatchObject({ installed: true, loaded: false, state: null, lastExitCode: null, runs: null, scriptPath: "/x/run.sh", plistSlots: ["Sun@00:00"] });
  });

  it("treats a missing or unreadable plist as no slots", () => {
    expect(toLaunchdJob("/p.plist", null, null)).toMatchObject({ installed: false, scriptPath: null, plistSlots: [] });
    expect(toLaunchdJob("/p.plist", { StartCalendarInterval: "bad" }, "\truns = x")).toMatchObject({ installed: true, plistSlots: [], runs: null, state: null });
  });
});
