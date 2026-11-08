import type { RunSummary } from "../../shared/models/run.ts";
import type { LogChunk } from "../../shared/models/logChunk.ts";

/**
 * Where runs come from (SPEC.md §4.2). Phase 1 reads launchd's run logs;
 * Phase 3 adds an app-owned source behind the same interface, so the
 * services, API and UI don't change.
 */
export interface RunSource {
  /** Newest first. */
  listRuns(agent: string, limit: number): Promise<RunSummary[]>;
  /** Throws NotFoundError for an unknown run. */
  getRun(agent: string, runId: string): Promise<{ summary: RunSummary; report: string | null }>;
  /** Throws NotFoundError for an unknown run. */
  readLog(agent: string, runId: string, offset: number): Promise<LogChunk>;
}
