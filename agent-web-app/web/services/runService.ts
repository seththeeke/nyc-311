import { z } from "zod";
import { logChunkSchema, type LogChunk } from "../../shared/models/logChunk.ts";
import { runSummarySchema, type RunSummary } from "../../shared/models/run.ts";
import { runDetailSchema, type RunDetail } from "../../shared/models/runDetail.ts";
import { runStartedSchema, type RunRequest, type RunStarted } from "../../shared/models/runRequest.ts";
import { getJson, postJson } from "./apiClient.ts";

const runPath = (agent: string, runId: string) => `/agents/${encodeURIComponent(agent)}/runs/${encodeURIComponent(runId)}`;

export function listRuns(agent: string, limit: number): Promise<RunSummary[]> {
  return getJson(`/agents/${encodeURIComponent(agent)}/runs?limit=${limit}`, z.array(runSummarySchema));
}

export function getRun(agent: string, runId: string): Promise<RunDetail> {
  return getJson(runPath(agent, runId), runDetailSchema);
}

export function readRunLog(agent: string, runId: string, offset = 0): Promise<LogChunk> {
  return getJson(`${runPath(agent, runId)}/log?offset=${offset}`, logChunkSchema);
}

/** Starts the agent now, outside its schedule (SPEC.md §5.1). */
export function startRun(agent: string, request: RunRequest): Promise<RunStarted> {
  return postJson(`/agents/${encodeURIComponent(agent)}/run`, request, runStartedSchema);
}
