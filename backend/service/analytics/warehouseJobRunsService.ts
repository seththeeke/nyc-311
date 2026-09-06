import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { logInfo } from "../../logger";
import { WarehouseJobRunsDao } from "../../dao/analytics/warehouseJobRunsDao";
import type { WarehouseJobRunListResponse } from "../../models/warehouseJobRun";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getDefaultJobRunsDao(): WarehouseJobRunsDao {
  return new WarehouseJobRunsDao(
    DynamoDBDocumentClient.from(new DynamoDBClient({})),
    requireEnv("WAREHOUSE_JOB_RUNS_TABLE_NAME")
  );
}

/* A page big enough to be useful on /data without ever needing pagination at 1 run/day. */
const DEFAULT_LIMIT = 100;

export interface ListWarehouseJobRunsDeps {
  jobRunsDao?: WarehouseJobRunsDao;
  limit?: number;
}

/** Backs `GET /data/jobs` (`7-data-warehousing.md` §12) — most-recent-first job run history. */
export async function listWarehouseJobRuns(
  deps: ListWarehouseJobRunsDeps = {}
): Promise<WarehouseJobRunListResponse> {
  const jobRunsDao = deps.jobRunsDao ?? getDefaultJobRunsDao();
  const limit = deps.limit ?? DEFAULT_LIMIT;

  logInfo("ListWarehouseJobRunsStarted", { limit });
  const jobRuns = await jobRunsDao.listRecentJobRuns(limit);
  logInfo("ListWarehouseJobRunsCompleted", { count: jobRuns.length });
  return { jobRuns };
}
