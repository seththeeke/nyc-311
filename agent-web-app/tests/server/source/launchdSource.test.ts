import { describe, expect, it } from "vitest";
import path from "node:path";
import { plistPath, readLaunchctlPrint, readLaunchdLog, readPlistJson } from "../../../server/source/launchdSource.ts";
import { ALPHA_PLIST_JSON, MACHINE, stubRunner } from "../fixtures.ts";

const launchAgents = path.join(MACHINE, "LaunchAgents");

describe("launchdSource", () => {
  it("reads an installed plist through plutil", async () => {
    const run = stubRunner({ plutil: { stdout: ALPHA_PLIST_JSON, code: 0 } });
    expect(await readPlistJson(launchAgents, "alpha-agent", run)).toMatchObject({ ProgramArguments: expect.any(Array) });
    expect(run.calls[0]).toBe(`plutil -convert json -o - ${plistPath(launchAgents, "alpha-agent")}`);
  });

  it("is null when the plist is missing, plutil fails, or its output isn't JSON", async () => {
    expect(await readPlistJson(launchAgents, "gamma-agent", stubRunner({}))).toBeNull();
    expect(await readPlistJson(launchAgents, "alpha-agent", stubRunner({}))).toBeNull();
    expect(await readPlistJson(launchAgents, "alpha-agent", stubRunner({ plutil: { stdout: "nope", code: 0 } }))).toBeNull();
  });

  it("reads launchctl print, or null when the job isn't loaded", async () => {
    const run = stubRunner({ "launchctl print gui/501/com.nyc311.agent.alpha-agent": { stdout: "state = running", code: 0 } });
    expect(await readLaunchctlPrint(501, "alpha-agent", run)).toBe("state = running");
    expect(await readLaunchctlPrint(501, "beta-agent", run)).toBeNull();
  });

  it("reads launchd.log with its modified time, or null", async () => {
    const log = await readLaunchdLog(path.join(MACHINE, "logs"), "beta-agent");
    expect(log?.text).toContain("Operation not permitted");
    expect(log?.modifiedAt).toBeInstanceOf(Date);
    expect(await readLaunchdLog(path.join(MACHINE, "logs"), "gamma-agent")).toBeNull();
  });
});
