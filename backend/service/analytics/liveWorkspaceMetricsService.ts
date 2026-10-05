import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { requireEnv } from "../../env";
import { logInfo, logWarn } from "../../logger";
import { LiveWorkspaceMetricsDao } from "../../dao/analytics/liveWorkspaceMetricsDao";
import { OperatorDao } from "../../dao/operator/operatorDao";
import { OrderDao } from "../../dao/order/orderDao";
import { ValidationError } from "../../models/errors";
import type { LiveMetricsDayBucket } from "../../models/liveWorkspaceMetrics";
import type { OrderEvent } from "../../models/order";
import type { WorkspaceMetricId, WorkspaceMetrics, WorkspaceMetricValue } from "../../models/workspaceMetrics";
import { addDays, newYorkDate, weekStartOf, weekToDateDays } from "./newYorkWeek";

/** `source_job` on a live response — there is no warehouse job behind it. */
export const LIVE_SOURCE_NAME = "live";

const SECONDS_PER_HOUR = 3600;

/* All three constructed lazily, per function that needs one (CLAUDE.md §5.2) — never a module-scope singleton. */
function getDocumentClient(): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(new DynamoDBClient({}));
}

function getLiveWorkspaceMetricsDao(): LiveWorkspaceMetricsDao {
  return new LiveWorkspaceMetricsDao(getDocumentClient(), requireEnv("LIVE_WORKSPACE_METRICS_TABLE_NAME"));
}

function getOrderDao(): OrderDao {
  return new OrderDao(getDocumentClient(), requireEnv("ORDERS_TABLE_NAME"));
}

function getOperatorDao(): OperatorDao {
  return new OperatorDao(getDocumentClient(), requireEnv("OPERATORS_TABLE_NAME"));
}

export interface LiveWorkspaceMetricsDeps {
  liveWorkspaceMetricsDao?: LiveWorkspaceMetricsDao;
  orderDao?: OrderDao;
  operatorDao?: OperatorDao;
  now?: () => Date;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/* Whole seconds between two ISO timestamps, truncated — same as the wbr job's date_diff('second', ...). */
function wholeSecondsBetween(startIso: string, endIso: string): number {
  const seconds = Math.floor((Date.parse(endIso) - Date.parse(startIso)) / 1000);
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new ValidationError(`Cannot derive a duration from ${startIso} to ${endIso}`);
  }
  return seconds;
}

function parseOccurredAt(orderEvent: OrderEvent): Date {
  const occurredAt = new Date(orderEvent.occurred_at);
  if (Number.isNaN(occurredAt.getTime())) {
    throw new ValidationError(`OrderEvent ${orderEvent.order_id}#${orderEvent.sequence_number} has an unparseable occurred_at`);
  }
  return occurredAt;
}

async function recordAccepted(orderEvent: OrderEvent, deps: LiveWorkspaceMetricsDeps): Promise<void> {
  const liveDao = deps.liveWorkspaceMetricsDao ?? getLiveWorkspaceMetricsDao();
  const day = newYorkDate(parseOccurredAt(orderEvent));
  const counted = await liveDao.recordAccepted({ orderId: orderEvent.order_id, day });
  logInfo(counted ? "LiveMetricsAcceptedCounted" : "LiveMetricsAcceptedDuplicateSkipped", { orderId: orderEvent.order_id, day });
}

/**
 * Labor cost, same rule as `docs/v1-wbr.sql`: hours from the Order's last
 * `ORDER_SCHEDULED` to its resolution × that Operator's `rate_per_hour`;
 * 0 when either the schedule event or the Operator can't be found.
 */
async function laborCost(orderEvent: OrderEvent, events: OrderEvent[], deps: LiveWorkspaceMetricsDeps): Promise<number> {
  const scheduled = events
    .filter((event) => event.event_type === "ORDER_SCHEDULED")
    .sort((a, b) => b.sequence_number - a.sequence_number)[0];
  const operatorId = scheduled?.payload["operator_id"];
  if (!scheduled || typeof operatorId !== "string") {
    logWarn("LiveMetricsResolvedNoScheduleEvent", { orderId: orderEvent.order_id });
    return 0;
  }
  const operator = await (deps.operatorDao ?? getOperatorDao()).getOperator(operatorId);
  if (!operator) {
    logWarn("LiveMetricsResolvedOperatorNotFound", { orderId: orderEvent.order_id, operatorId });
    return 0;
  }
  const laborSeconds = wholeSecondsBetween(scheduled.occurred_at, orderEvent.occurred_at);
  const cost = (laborSeconds / SECONDS_PER_HOUR) * operator.rate_per_hour;
  logInfo("LiveMetricsLaborCostDerived", { orderId: orderEvent.order_id, operatorId, laborSeconds, ratePerHour: operator.rate_per_hour, cost });
  return cost;
}

async function recordResolved(orderEvent: OrderEvent, deps: LiveWorkspaceMetricsDeps): Promise<void> {
  const liveDao = deps.liveWorkspaceMetricsDao ?? getLiveWorkspaceMetricsDao();
  const orderDao = deps.orderDao ?? getOrderDao();
  const day = newYorkDate(parseOccurredAt(orderEvent));

  const events = await orderDao.listOrderEvents(orderEvent.order_id);
  const createdAt = events
    .filter((event) => event.event_type === "ORDER_CREATED")
    .map((event) => event.occurred_at)
    .sort()[0];
  if (createdAt === undefined) {
    /* The wbr job inner-joins on ORDER_CREATED, so such an Order isn't counted there either. */
    logWarn("LiveMetricsResolvedNoCreatedEvent", { orderId: orderEvent.order_id, eventCount: events.length });
    return;
  }

  const resolutionSeconds = wholeSecondsBetween(createdAt, orderEvent.occurred_at);
  const rawMaterials = orderEvent.payload["materials_cost_actual"];
  const materialsCost = typeof rawMaterials === "number" && Number.isFinite(rawMaterials) ? rawMaterials : 0;
  const labor = await laborCost(orderEvent, events, deps);
  const totalCost = labor + materialsCost;
  logInfo("LiveMetricsResolvedDerived", { orderId: orderEvent.order_id, day, resolutionSeconds, labor, materialsCost, totalCost });

  const counted = await liveDao.recordResolved({ orderId: orderEvent.order_id, day, resolutionSeconds, totalCost });
  logInfo(counted ? "LiveMetricsResolvedCounted" : "LiveMetricsResolvedDuplicateSkipped", { orderId: orderEvent.order_id, day });
}

/**
 * Folds one `OrderEvent` into its New York day's bucket: `ORDER_ACCEPTED`
 * bumps the accepted count; `ORDER_RESOLVED` adds the Order's resolution
 * time and cost. Idempotent per Order + event type. Any other event type
 * is ignored — the queue's filter policy shouldn't deliver one.
 *
 * @throws {@link ValidationError} for an unparseable or inverted timestamp.
 */
export async function recordWorkspaceMetricEvent(orderEvent: OrderEvent, deps: LiveWorkspaceMetricsDeps = {}): Promise<void> {
  logInfo("RecordWorkspaceMetricEventStarted", {
    orderId: orderEvent.order_id,
    eventType: orderEvent.event_type,
    sequenceNumber: orderEvent.sequence_number,
    occurredAt: orderEvent.occurred_at,
  });
  if (orderEvent.event_type === "ORDER_ACCEPTED") {
    await recordAccepted(orderEvent, deps);
  } else if (orderEvent.event_type === "ORDER_RESOLVED") {
    await recordResolved(orderEvent, deps);
  } else {
    logWarn("RecordWorkspaceMetricEventIgnored", { orderId: orderEvent.order_id, eventType: orderEvent.event_type });
  }
}

/* The exact median: the middle value, or the mean of the two middle values for an even count. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function nullMetrics(): Record<WorkspaceMetricId, number | null> {
  return {
    REQUESTS_ACCEPTED: null,
    SERVICED: null,
    MEAN_TIME_TO_RESOLVE_HOURS: null,
    MEDIAN_TIME_TO_RESOLVE_HOURS: null,
    TOTAL_COST: null,
  };
}

/** Sums a run of day buckets into the five tile values; a day with no bucket contributes nothing. */
function summarize(days: string[], buckets: Map<string, LiveMetricsDayBucket>): Record<WorkspaceMetricId, number | null> {
  const present = days.map((day) => buckets.get(day)).filter((bucket): bucket is LiveMetricsDayBucket => bucket !== undefined);
  const sum = (pick: (bucket: LiveMetricsDayBucket) => number | undefined): number =>
    present.reduce((total, bucket) => total + (pick(bucket) ?? 0), 0);

  const resolved = sum((bucket) => bucket.resolved_count);
  const medianSeconds = median(present.flatMap((bucket) => bucket.resolution_seconds ?? []));
  return {
    REQUESTS_ACCEPTED: sum((bucket) => bucket.accepted_count),
    SERVICED: resolved,
    MEAN_TIME_TO_RESOLVE_HOURS:
      resolved > 0 ? round2(sum((bucket) => bucket.resolution_seconds_sum) / resolved / SECONDS_PER_HOUR) : null,
    MEDIAN_TIME_TO_RESOLVE_HOURS: medianSeconds === null ? null : round2(medianSeconds / SECONDS_PER_HOUR),
    TOTAL_COST: round2(sum((bucket) => bucket.total_cost_sum)),
  };
}

/**
 * The live tile values: this New York week to date (Monday through
 * today), against the same days of the week before. The current week
 * always has values (zero counts once it starts); the previous side is
 * all-null when none of its days has a bucket, e.g. before this shipped.
 */
export async function getLiveWorkspaceMetrics(deps: LiveWorkspaceMetricsDeps = {}): Promise<WorkspaceMetrics> {
  const liveDao = deps.liveWorkspaceMetricsDao ?? getLiveWorkspaceMetricsDao();
  const now = (deps.now ?? (() => new Date()))();

  const today = newYorkDate(now);
  const weekStart = weekStartOf(today);
  const previousWeekStart = addDays(weekStart, -7);
  const currentDays = weekToDateDays(weekStart, today);
  const previousDays = currentDays.map((day) => addDays(day, -7));
  logInfo("GetLiveWorkspaceMetricsStarted", { today, weekStart, previousWeekStart, currentDays, previousDays });

  const buckets = await liveDao.getDayBuckets([...currentDays, ...previousDays]);
  logInfo("GetLiveWorkspaceMetricsBucketsLoaded", { requested: currentDays.length * 2, found: [...buckets.keys()].sort() });

  const current = summarize(currentDays, buckets);
  const hasPrevious = previousDays.some((day) => buckets.has(day));
  if (!hasPrevious) logInfo("GetLiveWorkspaceMetricsNoPreviousWeek", { previousDays });
  const previous = hasPrevious ? summarize(previousDays, buckets) : nullMetrics();

  const metrics = Object.fromEntries(
    (Object.keys(current) as WorkspaceMetricId[]).map((id) => [id, { current: current[id], previous: previous[id] }])
  ) as Record<WorkspaceMetricId, WorkspaceMetricValue>;

  const response: WorkspaceMetrics = {
    source: "LIVE",
    source_job: LIVE_SOURCE_NAME,
    job_run_id: null,
    computed_at: now.toISOString(),
    week_start: weekStart,
    previous_week_start: previousWeekStart,
    metrics,
  };
  logInfo("GetLiveWorkspaceMetricsCompleted", { weekStart, previousWeekStart, metrics });
  return response;
}
