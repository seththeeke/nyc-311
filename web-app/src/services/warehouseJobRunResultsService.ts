import { fetchAuthSession } from "aws-amplify/auth";
import { config } from "../config";
import { JobRunResultsResponseSchema, type JobRunResultItem } from "../models/jobRunResults";
import { MOCK_JOB_RUN_RESULTS } from "../test-data/jobRunResults";

/*
 * One interface, two implementations, selected by config.dataMode
 * (CLAUDE.md §5.1) — same shape as warehouseJobDefinitionService. Backs
 * the admin Reports tab (7-data-warehousing.md §12b's addition): a bulk
 * fetch of raw job-run results by id, sized for a future multi-report
 * dashboard even though today's UI only ever requests one id at a time.
 */
export interface WarehouseJobRunResultsService {
  getJobRunResults(jobRunIds: string[]): Promise<JobRunResultItem[]>;
}

async function authorizedFetch(path: string, init?: RequestInit): Promise<Response> {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();
  if (!idToken) {
    throw new Error("Not authenticated");
  }
  return fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${idToken}` },
  });
}

async function errorMessageFrom(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? `${fallback}: HTTP ${response.status}`;
}

class LiveWarehouseJobRunResultsService implements WarehouseJobRunResultsService {
  async getJobRunResults(jobRunIds: string[]): Promise<JobRunResultItem[]> {
    const response = await authorizedFetch("/admin/warehouse/job-runs/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_run_ids: jobRunIds }),
    });
    if (!response.ok) {
      throw new Error(await errorMessageFrom(response, "Failed to load job run results"));
    }
    const body: unknown = await response.json();
    return JobRunResultsResponseSchema.parse(body).results;
  }
}

/** Mirrors the real endpoint's per-item degradation: an id with no fixture returns an error item, not a thrown rejection. */
class MockWarehouseJobRunResultsService implements WarehouseJobRunResultsService {
  async getJobRunResults(jobRunIds: string[]): Promise<JobRunResultItem[]> {
    return jobRunIds.map((jobRunId) => {
      const result = MOCK_JOB_RUN_RESULTS[jobRunId];
      return result ? { job_run_id: jobRunId, result, error: null } : { job_run_id: jobRunId, result: null, error: "No result for this job run" };
    });
  }
}

export const warehouseJobRunResultsService: WarehouseJobRunResultsService =
  config.dataMode === "live" ? new LiveWarehouseJobRunResultsService() : new MockWarehouseJobRunResultsService();
