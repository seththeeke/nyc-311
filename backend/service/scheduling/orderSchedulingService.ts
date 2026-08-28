import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { logInfo, logWarn } from "../../logger";
import { OrderDao } from "../../dao/order/orderDao";
import { RequestDao } from "../../dao/request/requestDao";
import { LocationDao } from "../../dao/location/locationDao";
import { OperatorDao } from "../../dao/operator/operatorDao";
import { createCase } from "../case/caseService";
import type { Order } from "../../models/order";
import {
  mockCapacityAvailabilityProvider,
  type CapacityAvailabilityProvider,
} from "./capacityAvailabilityService";
import { mockTransitTimeEstimator, type TransitTimeEstimator } from "./transitTimeService";
import { mockProcessingTimeEstimator, type ProcessingTimeEstimator } from "./processingTimeService";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/* Constructed lazily inside scheduleOrders, not at module scope — per CLAUDE.md §5.2. */
function getDefaultOrderDao(): OrderDao {
  return new OrderDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), requireEnv("ORDERS_TABLE_NAME"));
}
function getDefaultRequestDao(): RequestDao {
  return new RequestDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), requireEnv("REQUESTS_TABLE_NAME"));
}
function getDefaultLocationDao(): LocationDao {
  return new LocationDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), requireEnv("LOCATIONS_TABLE_NAME"));
}
function getDefaultOperatorDao(): OperatorDao {
  return new OperatorDao();
}

/*
 * Defensive bound on Lambda runtime, not a real volume constraint at this
 * project's scale (6-order-scheduling.md §2) — same reasoning as the
 * poller's own per-run record cap.
 */
const MAX_ORDERS_PER_RUN = 200;
/* Page size for each gsi1-stage-sla Query call while paging up to MAX_ORDERS_PER_RUN. */
const QUERY_PAGE_SIZE = 50;

/** WORKFLOW_EXECUTION_FAILURE is the closest existing case_type fit — same placeholder precedent as 5-order-evaluation.md §5. */
const UNROUTABLE_CASE_REASON = "Cannot derive a capacity pool — missing Request/Location data or agency/borough";

export interface SchedulingRunSummary {
  ordersConsidered: number;
  ordersScheduled: number;
  ordersSkippedNoCapacity: number;
  ordersCasedUnroutable: number;
  ordersFailed: number;
}

/**
 * Dependencies for {@link scheduleOrders} — all default to this module's
 * own singletons/mocks. `capacityProvider`/`transitEstimator`/
 * `processingEstimator` are swappable for a future real implementation
 * without this orchestration changing (6-order-scheduling.md §4/§5).
 */
export interface OrderSchedulingDeps {
  orderDao?: OrderDao;
  requestDao?: RequestDao;
  locationDao?: LocationDao;
  operatorDao?: OperatorDao;
  capacityProvider?: CapacityAvailabilityProvider;
  transitEstimator?: TransitTimeEstimator;
  processingEstimator?: ProcessingTimeEstimator;
  createCaseFn?: typeof createCase;
  now?: () => Date;
}

/** `"AGENCY#BOROUGH"`, ddb-design.md's Shifts `gsi1-pool` shape (e.g. `"DSNY#QUEENS"`). `null` if either half is missing. */
function derivePool(agency: string | null, borough: string | null): string | null {
  if (!agency || !borough) return null;
  return `${agency}#${borough}`;
}

/**
 * Attempts to dispatch one Order waiting in `SCHEDULE`, per
 * 6-order-scheduling.md §7's a/b/c/d sequence. Mutates `poolBudgets` on a
 * successful dispatch. Never throws for a normal outcome (skip, Case) —
 * only for a genuine DAO failure, which the caller (§7's per-order
 * isolation) catches.
 */
async function dispatchOneOrder(
  order: Order,
  deps: Required<
    Pick<
      OrderSchedulingDeps,
      | "orderDao"
      | "requestDao"
      | "locationDao"
      | "operatorDao"
      | "capacityProvider"
      | "transitEstimator"
      | "processingEstimator"
      | "createCaseFn"
      | "now"
    >
  >,
  poolBudgets: Map<string, number>
): Promise<"SCHEDULED" | "SKIPPED_NO_CAPACITY" | "CASED_UNROUTABLE"> {
  logInfo("OrderScheduleAttemptStarted", { orderId: order.order_id });

  const [request, location] = await Promise.all([
    deps.requestDao.getRequestById(order.request_id),
    deps.locationDao.getLocation(order.location_id),
  ]);
  const pool = request && location ? derivePool(request.agency, location.borough) : null;

  if (!pool || !request || !location) {
    logWarn("OrderScheduleCaseCreated", { orderId: order.order_id, reason: UNROUTABLE_CASE_REASON });
    await deps.createCaseFn({
      case_type: "WORKFLOW_EXECUTION_FAILURE",
      request_id: order.request_id,
      order_id: order.order_id,
      reason: UNROUTABLE_CASE_REASON,
    });
    await deps.orderDao.recordCaseCreated(order.order_id, UNROUTABLE_CASE_REASON);
    return "CASED_UNROUTABLE";
  }

  let remaining = poolBudgets.get(pool);
  if (remaining === undefined) {
    remaining = await deps.capacityProvider.getAvailableUnits(pool);
    poolBudgets.set(pool, remaining);
  }
  if (remaining <= 0) {
    logInfo("OrderScheduleSkippedNoCapacity", { orderId: order.order_id, pool });
    return "SKIPPED_NO_CAPACITY";
  }

  const [transitMinutes, processingMinutes, operator] = await Promise.all([
    deps.transitEstimator.estimateMinutes(order, location),
    deps.processingEstimator.estimateMinutes(order, request),
    deps.operatorDao.getOperator(),
  ]);

  const scheduledStart = deps.now();
  const scheduledEnd = new Date(scheduledStart.getTime() + (transitMinutes + processingMinutes) * 60 * 1000);

  await deps.orderDao.scheduleOrder(order.order_id, {
    scheduledStart: scheduledStart.toISOString(),
    scheduledEnd: scheduledEnd.toISOString(),
    operatorId: operator.operator_id,
  });
  poolBudgets.set(pool, remaining - 1);

  logInfo("OrderScheduled", {
    orderId: order.order_id,
    pool,
    operatorId: operator.operator_id,
    scheduledStart: scheduledStart.toISOString(),
    scheduledEnd: scheduledEnd.toISOString(),
  });
  return "SCHEDULED";
}

/**
 * The order-scheduling job's entry point (6-order-scheduling.md §7) —
 * pages through Orders waiting in `SCHEDULE` (oldest `sla_deadline` first),
 * and for each one, in order, derives its capacity pool, reserves budget
 * against the (mocked) `CapacityAvailabilityProvider`, and either dispatches
 * it or leaves it for next run. One bad Order never aborts the run (§7's
 * per-order error isolation).
 */
export async function scheduleOrders(deps: OrderSchedulingDeps = {}): Promise<SchedulingRunSummary> {
  const resolvedDeps = {
    orderDao: deps.orderDao ?? getDefaultOrderDao(),
    requestDao: deps.requestDao ?? getDefaultRequestDao(),
    locationDao: deps.locationDao ?? getDefaultLocationDao(),
    operatorDao: deps.operatorDao ?? getDefaultOperatorDao(),
    capacityProvider: deps.capacityProvider ?? mockCapacityAvailabilityProvider,
    transitEstimator: deps.transitEstimator ?? mockTransitTimeEstimator,
    processingEstimator: deps.processingEstimator ?? mockProcessingTimeEstimator,
    createCaseFn: deps.createCaseFn ?? createCase,
    now: deps.now ?? (() => new Date()),
  };

  logInfo("OrderSchedulingRunStarted", {});

  const summary: SchedulingRunSummary = {
    ordersConsidered: 0,
    ordersScheduled: 0,
    ordersSkippedNoCapacity: 0,
    ordersCasedUnroutable: 0,
    ordersFailed: 0,
  };
  const poolBudgets = new Map<string, number>();

  let cursor: string | null = null;
  do {
    const page = await resolvedDeps.orderDao.listOrdersWaitingForSchedule({
      limit: Math.min(QUERY_PAGE_SIZE, MAX_ORDERS_PER_RUN - summary.ordersConsidered),
      cursor,
    });

    for (const order of page.orders) {
      summary.ordersConsidered += 1;
      try {
        const outcome = await dispatchOneOrder(order, resolvedDeps, poolBudgets);
        if (outcome === "SCHEDULED") summary.ordersScheduled += 1;
        else if (outcome === "SKIPPED_NO_CAPACITY") summary.ordersSkippedNoCapacity += 1;
        else summary.ordersCasedUnroutable += 1;
      } catch (err) {
        summary.ordersFailed += 1;
        logWarn("OrderScheduleFailed", { orderId: order.order_id, error: err instanceof Error ? err.message : err });
      }
    }

    cursor = page.nextCursor;
  } while (cursor && summary.ordersConsidered < MAX_ORDERS_PER_RUN);

  logInfo("OrderSchedulingRunCompleted", { summary });
  return summary;
}
