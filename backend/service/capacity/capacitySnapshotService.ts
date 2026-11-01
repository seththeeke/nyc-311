import { createDocumentClient } from "../../dynamoClient";
import { requireEnv } from "../../env";
import { logInfo } from "../../logger";
import { LiveWorkspaceMetricsDao } from "../../dao/analytics/liveWorkspaceMetricsDao";
import { OperatorDao } from "../../dao/operator/operatorDao";
import { OrderDao } from "../../dao/order/orderDao";
import type { CapacitySnapshot } from "../../models/capacitySnapshot";
import { addDays, newYorkDate } from "../analytics/newYorkWeek";
import { getCapacityLimits } from "./capacityService";

/* The COO's goal (docs/17-executive-team.md §12.1): keep the median time to resolve in this band. */
export const TARGET_MEDIAN_DAYS = { min: 1, max: 2 };
const DAYS_OF_HISTORY = 14;
const MEDIAN_WINDOW_DAYS = 7;
const SECONDS_PER_DAY = 86_400;
const BACKLOG_PAGE = 500;

export interface CapacitySnapshotDeps {
  operatorDao?: OperatorDao;
  orderDao?: OrderDao;
  metricsDao?: LiveWorkspaceMetricsDao;
  now?: () => Date;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const toDays = (seconds: number | null): number | null => (seconds === null ? null : Math.round((seconds / SECONDS_PER_DAY) * 100) / 100);

/**
 * `GET /capacity/snapshot` (§12.3): the data behind a capacity decision.
 * It states facts (fleet, medians, flow, backlog, spend, today's caps) and
 * recommends nothing; the COO decides.
 */
export async function getCapacitySnapshot(deps: CapacitySnapshotDeps = {}): Promise<CapacitySnapshot> {
  const operatorDao = deps.operatorDao ?? new OperatorDao(createDocumentClient(), requireEnv("OPERATORS_TABLE_NAME"));
  const orderDao = deps.orderDao ?? new OrderDao(createDocumentClient(), requireEnv("ORDERS_TABLE_NAME"));
  const metricsDao = deps.metricsDao ?? new LiveWorkspaceMetricsDao(createDocumentClient(), requireEnv("LIVE_WORKSPACE_METRICS_TABLE_NAME"));
  const now = deps.now ? deps.now() : new Date();
  logInfo("GetCapacitySnapshotStarted", { at: now.toISOString() });

  const today = newYorkDate(now);
  const days = Array.from({ length: DAYS_OF_HISTORY }, (_, i) => addDays(today, -i));
  const [roster, buckets, limits] = await Promise.all([operatorDao.listActiveRoster(), metricsDao.getDayBuckets(days), getCapacityLimits({ operatorDao, now: () => now })]);

  let waiting = 0;
  let oldest: string | null = null;
  let cursor: string | null = null;
  do {
    const page = await orderDao.listOrdersWaitingForSchedule({ limit: BACKLOG_PAGE, cursor });
    waiting += page.orders.length;
    for (const order of page.orders) if (oldest === null || order.created_at < oldest) oldest = order.created_at;
    cursor = page.nextCursor;
  } while (cursor);

  const idle = roster.filter((operator) => operator.current_activity === "IDLE" && !operator.removal_requested_at).length;
  const snapshot: CapacitySnapshot = {
    computed_at: now.toISOString(),
    target_median_days: TARGET_MEDIAN_DAYS,
    fleet: { size: roster.length, idle, busy: roster.filter((operator) => operator.current_activity !== "IDLE").length, roster },
    median_days_to_resolve_7d: toDays(median(days.slice(0, MEDIAN_WINDOW_DAYS).flatMap((day) => buckets.get(day)?.resolution_seconds ?? []))),
    days: days.map((day) => {
      const bucket = buckets.get(day);
      return {
        day,
        accepted_count: bucket?.accepted_count ?? 0,
        resolved_count: bucket?.resolved_count ?? 0,
        median_days_to_resolve: toDays(median(bucket?.resolution_seconds ?? [])),
      };
    }),
    backlog: { waiting_to_schedule: waiting, oldest_waiting_since: oldest },
    hourly_burn_rate: roster.reduce((sum, operator) => sum + operator.rate_per_hour, 0),
    limits,
  };
  logInfo("GetCapacitySnapshotCompleted", { fleet: snapshot.fleet.size, median7d: snapshot.median_days_to_resolve_7d, backlog: waiting, limits });
  return snapshot;
}
