import { createDocumentClient } from "../../dynamoClient";
import { requireEnv } from "../../env";
import { LiveWorkspaceMetricsDao } from "./liveWorkspaceMetricsDao";

/**
 * Builds a fresh `LiveWorkspaceMetricsDao` on every call, reading
 * `LIVE_WORKSPACE_METRICS_TABLE_NAME` only then: the one place that names
 * this table's env var (§5.2: lazy, never module scope).
 */
export function getLiveWorkspaceMetricsDao(): LiveWorkspaceMetricsDao {
  return new LiveWorkspaceMetricsDao(createDocumentClient(), requireEnv("LIVE_WORKSPACE_METRICS_TABLE_NAME"));
}
