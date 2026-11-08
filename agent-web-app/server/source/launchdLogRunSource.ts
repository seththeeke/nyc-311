import path from "node:path";
import type { RunSource } from "./runSource.ts";
import { NotFoundError } from "../models/errors.ts";
import { listDir, mtimeOrNull, readFrom, readTextOrNull } from "./fileSource.ts";
import { parseRunLog } from "./runLogParser.ts";

const RUN_LOG = /^(\d{8}T\d{6})\.log$/;
const RUN_ID = /^\d{8}T\d{6}$/;
const AGENT_NAME = /^[a-z][a-z0-9-]*$/;
const MAX_CHUNK_BYTES = 256 * 1024;

export type PidCheck = (pid: number) => boolean;

/** True when a process with this pid exists (EPERM still means it exists). */
export const isPidAlive: PidCheck = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};

export interface RunLock {
  pid: number;
  alive: boolean;
}

/** The runner's per-agent lock (`<logRoot>/<agent>/.run.lock/pid`), or null when no run holds it. */
export async function readRunLock(logRoot: string, agent: string, pidCheck: PidCheck = isPidAlive): Promise<RunLock | null> {
  const text = await readTextOrNull(path.join(logRoot, agent, ".run.lock", "pid"));
  const pid = Number(text?.trim());
  if (!text || !Number.isInteger(pid) || pid <= 0) return null;
  return { pid, alive: pidCheck(pid) };
}

function assertIds(agent: string, runId: string): void {
  if (!AGENT_NAME.test(agent) || !RUN_ID.test(runId)) throw new NotFoundError(`No run ${runId} for ${agent}`);
}

/** Phase 1's RunSource: the per-run logs launchd's runs leave in `<logRoot>/<agent>/` (SPEC.md §2). */
export function createLaunchdLogRunSource(logRoot: string, pidCheck: PidCheck = isPidAlive): RunSource {
  const dirOf = (agent: string) => path.join(logRoot, agent);

  async function runIds(agent: string): Promise<string[]> {
    if (!AGENT_NAME.test(agent)) return [];
    return (await listDir(dirOf(agent)))
      .map((file) => RUN_LOG.exec(file)?.[1])
      .filter((id): id is string => id !== undefined)
      .sort()
      .reverse();
  }

  async function summarize(agent: string, runId: string, newest: string | undefined) {
    const text = await readTextOrNull(path.join(dirOf(agent), `${runId}.log`));
    if (text === null) throw new NotFoundError(`No run ${runId} for ${agent}`);
    const lock = runId === newest ? await readRunLock(logRoot, agent, pidCheck) : null;
    const hasReport = (await mtimeOrNull(path.join(dirOf(agent), `${runId}.report.md`))) !== null;
    return parseRunLog(text, { agent, runId, isRunning: lock?.alive === true, hasReport });
  }

  return {
    async listRuns(agent, limit) {
      const ids = await runIds(agent);
      return Promise.all(ids.slice(0, limit).map((id) => summarize(agent, id, ids[0])));
    },
    async getRun(agent, runId) {
      assertIds(agent, runId);
      const summary = await summarize(agent, runId, (await runIds(agent))[0]);
      const report = await readTextOrNull(path.join(dirOf(agent), `${runId}.report.md`));
      return { summary, report };
    },
    async readLog(agent, runId, offset) {
      assertIds(agent, runId);
      const chunk = await readFrom(path.join(dirOf(agent), `${runId}.log`), offset, MAX_CHUNK_BYTES);
      if (chunk === null) throw new NotFoundError(`No run ${runId} for ${agent}`);
      return { text: chunk.text, offset, nextOffset: chunk.nextOffset };
    },
  };
}
