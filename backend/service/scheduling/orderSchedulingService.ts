import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { logInfo, logWarn } from "../../logger";
import { OrderDao } from "../../dao/order/orderDao";
import { RequestDao } from "../../dao/request/requestDao";
import { LocationDao } from "../../dao/location/locationDao";
import { OperatorDao } from "../../dao/operator/operatorDao";
import type { Order } from "../../models/order";
import { HOME_DEPOT_LOCATION, type GpsLocation } from "../../models/gpsLocation";
import { mockTransitTimeEstimator, type TransitTimeEstimator } from "./transitTimeService";
import { mockProcessingTimeEstimator, type ProcessingTimeEstimator } from "./processingTimeService";
import { stepFunctionsOrderExecutionStarter, type OrderExecutionStarter } from "./orderExecutionStarter";

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
  return new OperatorDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), requireEnv("OPERATORS_TABLE_NAME"));
}

/*
 * Defensive bound on Lambda runtime, not a real volume constraint at this
 * project's scale (6-order-scheduling.md §2) — same reasoning as the
 * poller's own per-run record cap.
 */
const MAX_ORDERS_PER_RUN = 200;
/* Page size for each gsi1-stage-sla Query call while paging up to MAX_ORDERS_PER_RUN. */
const QUERY_PAGE_SIZE = 50;

export interface SchedulingRunSummary {
  ordersConsidered: number;
  ordersScheduled: number;
  ordersSkippedNoCapacity: number;
  ordersFailed: number;
}

/**
 * Dependencies for {@link scheduleOrders} — all default to this module's
 * own singletons/mocks. `transitEstimator`/`processingEstimator` are
 * swappable for a future real implementation without this orchestration
 * changing (6-order-scheduling.md §5); `executionStarter` likewise for
 * testing without a real Step Functions call.
 */
export interface OrderSchedulingDeps {
  orderDao?: OrderDao;
  requestDao?: RequestDao;
  locationDao?: LocationDao;
  operatorDao?: OperatorDao;
  transitEstimator?: TransitTimeEstimator;
  processingEstimator?: ProcessingTimeEstimator;
  executionStarter?: OrderExecutionStarter;
  now?: () => Date;
}

/** Falls back to `HOME_DEPOT_LOCATION` when a Location record is missing lat/lng — real 311 geodata is sometimes incomplete (§3.7). */
function resolveJobLocation(location: { latitude: string | null; longitude: string | null }): GpsLocation {
  if (!location.latitude || !location.longitude) return HOME_DEPOT_LOCATION;
  return { lat: Number(location.latitude), lng: Number(location.longitude) };
}

/**
 * Attempts to dispatch one Order waiting in `SCHEDULE`
 * (`10-capacity-modeling-and-integration.md` §3.5's flat, global capacity
 * check — no more agency/borough pools). Never throws for a normal
 * outcome (scheduled or skipped) — only for a genuine DAO failure, which
 * the caller (§7's per-order isolation, unchanged from
 * `6-order-scheduling.md`) catches.
 */
async function dispatchOneOrder(
  order: Order,
  deps: Required<
    Pick<
      OrderSchedulingDeps,
      "orderDao" | "requestDao" | "locationDao" | "operatorDao" | "transitEstimator" | "processingEstimator" | "executionStarter" | "now"
    >
  >
): Promise<"SCHEDULED" | "SKIPPED_NO_CAPACITY"> {
  logInfo("OrderScheduleAttemptStarted", { orderId: order.order_id });

  const idleOperator = await deps.operatorDao.findIdleOperator();
  if (!idleOperator) {
    logInfo("OrderScheduleSkippedNoCapacity", { orderId: order.order_id });
    return "SKIPPED_NO_CAPACITY";
  }

  const [request, location] = await Promise.all([
    deps.requestDao.getRequestById(order.request_id),
    deps.locationDao.getLocation(order.location_id),
  ]);
  if (!request || !location) {
    throw new Error(`Order ${order.order_id} has no resolvable Request/Location record`);
  }

  const [transitMinutes, processingMinutes] = await Promise.all([
    deps.transitEstimator.estimateMinutes(order, location),
    deps.processingEstimator.estimateMinutes(order, request),
  ]);

  const scheduledStart = deps.now();
  const scheduledEnd = new Date(scheduledStart.getTime() + (transitMinutes + processingMinutes) * 60 * 1000);

  /*
   * The scheduling job's own claim performs the idle->busy transition
   * (§3.6) — not deferred to the execution state machine's Dispatch
   * Task, so a later Order in this same run never sees this Operator as
   * idle again.
   */
  await deps.operatorDao.startTransit(idleOperator.operator_id);
  await deps.orderDao.scheduleOrder(order.order_id, {
    scheduledStart: scheduledStart.toISOString(),
    scheduledEnd: scheduledEnd.toISOString(),
    operatorId: idleOperator.operator_id,
  });

  await deps.executionStarter.startExecution({
    orderId: order.order_id,
    operatorId: idleOperator.operator_id,
    jobLocation: resolveJobLocation(location),
    transitMinutes,
    processingMinutes,
    scheduledStartDatetime: scheduledStart.toISOString(),
  });

  logInfo("OrderScheduled", {
    orderId: order.order_id,
    operatorId: idleOperator.operator_id,
    scheduledStart: scheduledStart.toISOString(),
    scheduledEnd: scheduledEnd.toISOString(),
  });
  return "SCHEDULED";
}

/**
 * The order-scheduling job's entry point (`6-order-scheduling.md` §7,
 * amended by `10-capacity-modeling-and-integration.md` §3.5) — pages
 * through Orders waiting in `SCHEDULE` (oldest `sla_deadline` first), and
 * for each one, in order, attempts to claim one idle `Operator` from the
 * real, global fleet; once the fleet is exhausted, every remaining Order
 * in the run is skipped. One bad Order never aborts the run (§7's
 * per-order error isolation).
 */
export async function scheduleOrders(deps: OrderSchedulingDeps = {}): Promise<SchedulingRunSummary> {
  const resolvedDeps = {
    orderDao: deps.orderDao ?? getDefaultOrderDao(),
    requestDao: deps.requestDao ?? getDefaultRequestDao(),
    locationDao: deps.locationDao ?? getDefaultLocationDao(),
    operatorDao: deps.operatorDao ?? getDefaultOperatorDao(),
    transitEstimator: deps.transitEstimator ?? mockTransitTimeEstimator,
    processingEstimator: deps.processingEstimator ?? mockProcessingTimeEstimator,
    executionStarter: deps.executionStarter ?? stepFunctionsOrderExecutionStarter,
    now: deps.now ?? (() => new Date()),
  };

  logInfo("OrderSchedulingRunStarted", {});

  const summary: SchedulingRunSummary = {
    ordersConsidered: 0,
    ordersScheduled: 0,
    ordersSkippedNoCapacity: 0,
    ordersFailed: 0,
  };

  let cursor: string | null = null;
  do {
    const page = await resolvedDeps.orderDao.listOrdersWaitingForSchedule({
      limit: Math.min(QUERY_PAGE_SIZE, MAX_ORDERS_PER_RUN - summary.ordersConsidered),
      cursor,
    });

    for (const order of page.orders) {
      summary.ordersConsidered += 1;
      try {
        const outcome = await dispatchOneOrder(order, resolvedDeps);
        if (outcome === "SCHEDULED") summary.ordersScheduled += 1;
        else summary.ordersSkippedNoCapacity += 1;
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
