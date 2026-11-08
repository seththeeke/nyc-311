import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseRunLog } from "../../../server/source/runLogParser.ts";
import { MACHINE, local } from "../fixtures.ts";

const log = (agent: string, runId: string) => readFileSync(path.join(MACHINE, "logs", agent, `${runId}.log`), "utf8");
const ctx = (agent: string, runId: string, isRunning = false) => ({ agent, runId, isRunning, hasReport: false });

describe("parseRunLog", () => {
  it("reads a finished operations run: slot mode, model, duration, chat post, warnings", () => {
    const run = parseRunLog(log("alpha-agent", "20261107T050004"), { ...ctx("alpha-agent", "20261107T050004"), hasReport: true });
    expect(run).toMatchObject({
      status: "SUCCEEDED", mode: "AUDIT", model: "opus", exitCode: 0, durationSeconds: 108,
      chatPostId: "01M6W0G1GQGVFVSFJPTFA0VYEH", warnings: ["git pull --ff-only failed; continuing on current primary"],
      startedAt: local(2026, 11, 7, 5, 0, 4), endedAt: local(2026, 11, 7, 5, 1, 54), hasReport: true, error: null,
    });
  });

  it("reads a failed pr-limit run with PRs before and after", () => {
    const run = parseRunLog(log("beta-agent", "20261105T060005"), ctx("beta-agent", "20261105T060005"));
    expect(run).toMatchObject({ status: "FAILED", mode: "NEW", exitCode: 1, durationSeconds: 300, openPrsBefore: "#158 #160", openPrsAfter: "#158 #160", warnings: ["no chat post reported"] });
  });

  it("marks a run that hit the lock as SKIPPED", () => {
    expect(parseRunLog(log("beta-agent", "20261105T180005"), ctx("beta-agent", "20261105T180005")).status).toBe("SKIPPED");
  });

  it("marks a run the runner died on as FAILED with the error", () => {
    const run = parseRunLog(log("beta-agent", "20261106T060005"), ctx("beta-agent", "20261106T060005"));
    expect(run).toMatchObject({ status: "FAILED", error: "'claude' not on PATH", durationSeconds: null });
  });

  it("is RUNNING while the lock is alive, ABORTED once it isn't", () => {
    const text = log("beta-agent", "20261106T180005");
    expect(parseRunLog(text, ctx("beta-agent", "20261106T180005", true))).toMatchObject({ status: "RUNNING", mode: "REVISE", openPrsBefore: "#1 #2 #3" });
    expect(parseRunLog(text, ctx("beta-agent", "20261106T180005")).status).toBe("ABORTED");
  });

  it("works out the duration from the done line when there's no 'agent exited' line", () => {
    expect(parseRunLog(log("beta-agent", "20261107T060005"), ctx("beta-agent", "20261107T060005")).durationSeconds).toBe(235);
  });

  it("treats an IDLE run as SKIPPED", () => {
    expect(parseRunLog(log("gamma-agent", "20261107T070001"), ctx("gamma-agent", "20261107T070001"))).toMatchObject({ status: "SKIPPED", mode: "IDLE" });
  });

  it("ignores unknown lines and survives a malformed run id", () => {
    const run = parseRunLog("garbage\n[not a stamp] x\n", ctx("x", "bad"));
    expect(run).toMatchObject({ status: "ABORTED", mode: null, startedAt: new Date(0).toISOString() });
  });

  it("keeps the earlier mode when the done line has none, and ignores a chat line without an id", () => {
    const text = "[2026-11-07 05:00:05] operations run → RUN\n[2026-11-07 05:00:06] team-chat: none\n[2026-11-07 05:00:07] === done (, exit 0)\n";
    expect(parseRunLog(text, ctx("x", "20261107T050004"))).toMatchObject({ mode: "RUN", chatPostId: null, status: "SUCCEEDED" });
  });
});
