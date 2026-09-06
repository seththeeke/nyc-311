import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { logInfo } from "../../logger";
import { AnalyticsRollupsDao } from "../../dao/analytics/analyticsRollupsDao";
import type { AnalyticsRollupListResponse } from "../../models/analyticsRollup";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getDefaultRollupsDao(): AnalyticsRollupsDao {
  return new AnalyticsRollupsDao(
    DynamoDBDocumentClient.from(new DynamoDBClient({})),
    requireEnv("ANALYTICS_ROLLUPS_TABLE_NAME")
  );
}

/** The only metric_view Leg 3 produces (`7-data-warehousing.md` §1/§8). */
export const SAMPLE_METRIC_VIEW = "ORDER_VOLUME_BY_STAGE";

const DEFAULT_LIMIT = 200;

export interface ListRollupsDeps {
  rollupsDao?: AnalyticsRollupsDao;
  metricView?: string;
  limit?: number;
}

/** Backs `GET /data/rollups` (`7-data-warehousing.md` §12) — the sample job's output, most recent first. */
export async function listRollups(deps: ListRollupsDeps = {}): Promise<AnalyticsRollupListResponse> {
  const rollupsDao = deps.rollupsDao ?? getDefaultRollupsDao();
  const metricView = deps.metricView ?? SAMPLE_METRIC_VIEW;
  const limit = deps.limit ?? DEFAULT_LIMIT;

  logInfo("ListRollupsStarted", { metricView, limit });
  const rollups = await rollupsDao.listRollups(metricView, limit);
  logInfo("ListRollupsCompleted", { count: rollups.length });
  return { rollups };
}
