import type { LogChunk } from "../../shared/models/logChunk.ts";
import type { RunSummary } from "../../shared/models/run.ts";
import type { RunDetail } from "../../shared/models/runDetail.ts";
import { logInfo } from "../logger.ts";
import { resolveDeps, type ServiceDeps } from "./deps.ts";

export async function listRuns(serviceDeps: ServiceDeps, agent: string, limit: number): Promise<RunSummary[]> {
  const runs = await resolveDeps(serviceDeps).runSource.listRuns(agent, limit);
  logInfo("listed runs", { agent, limit, count: runs.length });
  return runs;
}

export async function getRun(serviceDeps: ServiceDeps, agent: string, runId: string): Promise<RunDetail> {
  const { summary, report } = await resolveDeps(serviceDeps).runSource.getRun(agent, runId);
  logInfo("read run", { agent, runId, status: summary.status, hasReport: report !== null });
  return { ...summary, report };
}

export async function readRunLog(serviceDeps: ServiceDeps, agent: string, runId: string, offset: number): Promise<LogChunk> {
  const chunk = await resolveDeps(serviceDeps).runSource.readLog(agent, runId, offset);
  logInfo("read run log", { agent, runId, offset, nextOffset: chunk.nextOffset });
  return chunk;
}
