import { describe, expect, it } from "vitest";
import { agentHealth, cloneHealth, type AgentHealthInput } from "../../../server/service/healthService.ts";
import type { RunSummary } from "../../../shared/models/run.ts";

const run = (overrides: Partial<RunSummary> = {}): RunSummary => ({
  agent: "a", runId: "20261107T080000", startedAt: "2026-11-07T08:00:00.000Z", endedAt: null, status: "SUCCEEDED", mode: "RUN", model: null,
  exitCode: 0, durationSeconds: 60, chatPostId: null, openPrsBefore: null, openPrsAfter: null, warnings: [], error: null, hasReport: false, manual: false, ...overrides,
});

const healthy = (overrides: Partial<AgentHealthInput> = {}): AgentHealthInput => ({
  config: { name: "a", description: null, kind: "OPERATIONS", schedule: [{ day: null, time: "08:00", mode: null }], model: null, teamChatEnv: null, branchPrefix: null, maxOpenPrs: null, flags: [] },
  job: { installed: true, plistPath: "/p", scriptPath: "/clone/scripts/agent-scheduled-run.sh", plistSlots: ["08:00"], loaded: true, state: "not running", lastExitCode: 0, runs: 1 },
  lastRun: run(),
  newestStartedAt: "2026-11-07T08:00:00.000Z",
  launchdLog: { text: "", modifiedAt: new Date("2026-11-07T08:00:00Z") },
  lock: null,
  schedulerClone: "/clone",
  previousFireAt: "2026-11-07T08:00:00.000Z",
  now: new Date("2026-11-07T09:00:00Z"),
  ...overrides,
});

const codes = (input: AgentHealthInput) => agentHealth(input).map((finding) => finding.code);

describe("agentHealth", () => {
  it("finds nothing for a healthy agent", () => {
    expect(agentHealth(healthy())).toEqual([]);
  });

  it("reports only NOT_INSTALLED when there's no plist", () => {
    expect(codes(healthy({ job: { ...healthy().job, installed: false } }))).toEqual(["NOT_INSTALLED"]);
  });

  it("flags a paused job, a wrong checkout (with the ~/Documents note) and schedule drift", () => {
    const findings = agentHealth(healthy({ job: { ...healthy().job, loaded: false, scriptPath: "/Users/x/Documents/n/run.sh", plistSlots: [] } }));
    expect(findings.map((f) => f.code)).toEqual(["WRONG_CHECKOUT", "NOT_LOADED", "SCHEDULE_DRIFT"]);
    expect(findings[0].message).toContain("~/Documents");
    expect(findings[2].message).toContain("(none)");
    expect(agentHealth(healthy({ job: { ...healthy().job, scriptPath: "/other/run.sh" } }))[0].message).not.toContain("~/Documents");
  });

  it("flags launchd errors newer than the last run, and when there's no run at all", () => {
    const log = { text: "x\n/bin/sh: Operation not permitted\n", modifiedAt: new Date("2026-11-07T08:30:00Z") };
    const findings = agentHealth(healthy({ launchdLog: log }));
    expect(findings[0]).toMatchObject({ code: "LAUNCHD_ERROR", message: expect.stringContaining("Operation not permitted") });
    expect(codes(healthy({ launchdLog: log, lastRun: null, newestStartedAt: null }))).toContain("LAUNCHD_ERROR");
    expect(codes(healthy({ launchdLog: { ...log, modifiedAt: new Date("2026-11-07T07:00:00Z") } }))).toEqual([]);
  });

  it("flags failed and aborted last runs and their warnings", () => {
    expect(agentHealth(healthy({ lastRun: run({ status: "FAILED", exitCode: 1 }) }))[0].message).toContain("exit 1");
    expect(agentHealth(healthy({ lastRun: run({ status: "FAILED", error: "boom" }) }))[0].message).toContain("boom");
    expect(codes(healthy({ lastRun: run({ status: "ABORTED", warnings: ["w"] }) }))).toEqual(["LAST_RUN_ABORTED", "RUN_WARNINGS"]);
  });

  it("flags a missed slot only past the grace period", () => {
    const stale = { newestStartedAt: "2026-11-06T08:00:00.000Z" };
    expect(codes(healthy(stale))).toEqual(["MISSED_RUN"]);
    expect(codes(healthy({ ...stale, now: new Date("2026-11-07T08:05:00Z") }))).toEqual([]);
    expect(codes(healthy({ ...stale, previousFireAt: null }))).toEqual([]);
    expect(codes(healthy({ newestStartedAt: null }))).toEqual([]);
  });

  it("flags a stale lock", () => {
    expect(codes(healthy({ lock: { pid: 9, alive: false } }))).toEqual(["STALE_LOCK"]);
    expect(codes(healthy({ lock: { pid: 9, alive: true } }))).toEqual([]);
  });
});

describe("cloneHealth", () => {
  it("wants a clean main", () => {
    expect(cloneHealth("/c", "main", 0)).toEqual([]);
    expect(cloneHealth("/c", null, 2).map((f) => f.code)).toEqual(["CLONE_NOT_MAIN", "CLONE_DIRTY"]);
    expect(cloneHealth("/c", null, 0)[0].message).toContain("detached");
  });
});
