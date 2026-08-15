import { logInfo } from "../../logger";
import type { RequestDao } from "../../dao/request/requestDao";
import type { PollerMetrics } from "../../models/pollerMetrics";

export interface ListPollerMetricsDeps {
  requestDao: RequestDao;
}

/**
 * Returns the NYC 311 poller's full run history, most recent first — the
 * only query behind the public ingestion-metrics API (1-data-ingestion.md
 * §8a). Thin by design: `RequestDao.listPollerMetrics` already does the
 * real work (Query + validation), this layer exists so `controller/web-api`
 * never talks to a DAO directly, per CLAUDE.md §5.2.
 */
export async function listPollerMetrics(deps: ListPollerMetricsDeps): Promise<PollerMetrics[]> {
  const { requestDao } = deps;
  logInfo("ListPollerMetricsStarted", {});
  const metrics = await requestDao.listPollerMetrics();
  logInfo("ListPollerMetricsCompleted", { count: metrics.length });
  return metrics;
}
