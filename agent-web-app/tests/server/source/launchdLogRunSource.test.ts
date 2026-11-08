import { describe, expect, it } from "vitest";
import path from "node:path";
import { createLaunchdLogRunSource, isPidAlive, readRunLock } from "../../../server/source/launchdLogRunSource.ts";
import { NotFoundError } from "../../../server/models/errors.ts";
import { MACHINE } from "../fixtures.ts";

const logRoot = path.join(MACHINE, "logs");

describe("launchdLogRunSource", () => {
  it("lists runs newest first, ignoring non-run files, and marks the newest RUNNING while its lock is alive", async () => {
    const source = createLaunchdLogRunSource(logRoot, () => true);
    const runs = await source.listRuns("beta-agent", 10);
    expect(runs.map((run) => run.runId)).toEqual(["20261107T060005", "20261106T180005", "20261106T060005", "20261105T180005", "20261105T060005"]);
    const alpha = await source.listRuns("alpha-agent", 1);
    expect(alpha).toHaveLength(1);
    expect(alpha[0]).toMatchObject({ runId: "20261107T140004", status: "RUNNING", mode: "CONVERSE" });
  });

  it("reads the newest run as ABORTED when the lock's pid is dead", async () => {
    const [newest] = await createLaunchdLogRunSource(logRoot, () => false).listRuns("alpha-agent", 1);
    expect(newest.status).toBe("ABORTED");
  });

  it("returns no runs for an unknown or malformed agent", async () => {
    const source = createLaunchdLogRunSource(logRoot);
    expect(await source.listRuns("nobody", 5)).toEqual([]);
    expect(await source.listRuns("../etc", 5)).toEqual([]);
  });

  it("gets a run with its report, or a null report when there's none", async () => {
    const source = createLaunchdLogRunSource(logRoot, () => false);
    const withReport = await source.getRun("alpha-agent", "20261107T050004");
    expect(withReport.summary.hasReport).toBe(true);
    expect(withReport.report).toContain("Final Report");
    expect((await source.getRun("beta-agent", "20261105T060005")).report).toBeNull();
  });

  it("throws NotFoundError for unknown or malformed runs", async () => {
    const source = createLaunchdLogRunSource(logRoot);
    await expect(source.getRun("beta-agent", "20991105T060005")).rejects.toBeInstanceOf(NotFoundError);
    await expect(source.getRun("beta-agent", "../../x")).rejects.toBeInstanceOf(NotFoundError);
    await expect(source.readLog("BAD", "20261105T060005", 0)).rejects.toBeInstanceOf(NotFoundError);
    await expect(source.readLog("beta-agent", "20991105T060005", 0)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("reads the log from an offset for the live tail", async () => {
    const source = createLaunchdLogRunSource(logRoot);
    const full = await source.readLog("beta-agent", "20261105T180005", 0);
    expect(full.text).toContain("is in progress — skipping");
    const tail = await source.readLog("beta-agent", "20261105T180005", full.nextOffset);
    expect(tail).toEqual({ text: "", offset: full.nextOffset, nextOffset: full.nextOffset });
  });

  it("reads the run lock", async () => {
    expect(await readRunLock(logRoot, "alpha-agent", () => true)).toEqual({ pid: 4242, alive: true });
    expect(await readRunLock(logRoot, "beta-agent")).toBeNull();
  });

  it("checks pids for real", () => {
    expect(isPidAlive(process.pid)).toBe(true);
    expect(isPidAlive(2 ** 30)).toBe(false);
    expect(isPidAlive(1)).toBe(true);
  });
});
