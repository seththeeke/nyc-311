import { randomUUID } from "node:crypto";
import { logInfo, logWarn } from "../../logger";
import type { OrderDao } from "../../dao/order/orderDao";
import { getOrderDao } from "../../dao/order/getOrderDao";
import type { RequestDao } from "../../dao/request/requestDao";
import { getRequestDao } from "../../dao/request/getRequestDao";
import type { LocationDao } from "../../dao/location/locationDao";
import { getLocationDao } from "../../dao/location/getLocationDao";
import type { OperatorDao } from "../../dao/operator/operatorDao";
import { getOperatorDao } from "../../dao/operator/getOperatorDao";
import type { Order } from "../../models/order";
import { HOME_DEPOT_LOCATION, type GpsLocation } from "../../models/gpsLocation";
import { straightLineTransitTimeEstimator, type TransitTimeEstimator } from "./transitTimeService";
import type { ProcessingTimeEstimator } from "./processingTimeService";
import { streetConditionProcessingTimeEstimator } from "./streetConditionProcessingTimeService";
import type { MaterialsCostEstimator } from "./materialsCostService";
import { streetConditionMaterialsCostEstimator } from "./streetConditionMaterialsCostService";
import { stepFunctionsOrderExecutionStarter, type OrderExecutionStarter } from "./orderExecutionStarter";
import { failExecution } from "../execution/orderExecutionService";
import { ConflictError } from "../../models/errors";
import type { DispatchStamp, DispatchTrigger } from "../../models/dispatchDecision";
import { getDistance } from "./pathPlanningService";
import { resolveDispatchPolicy } from "./dispatchPolicyService";
import { recordDispatchDecision } from "./dispatchDecisionService";


/*
 * Defensive bound on Lambda runtime, not a real volume constraint at this
 * project's scale (6-order-scheduling.md §2) — same reasoning as the
 * poller's own per-run record cap.
 */
const MAX_ORDERS_PER_RUN = 200;
/* Page size for each gsi1-stage-sla Query call while paging up to MAX_ORDERS_PER_RUN. */
const QUERY_PAGE_SIZE = 50;
/* How many waiting orders a decision record lists as considered (20-ml-driver-assignment.md §5.1's K). */
const MAX_CONSIDERED_ORDERS = 30;

export interface SchedulingRunSummary {
  ordersConsidered: number;
  ordersScheduled: number;
  ordersSkippedNoCapacity: number;
  ordersFailed: number;
}

/**
 * Dependencies for {@link scheduleOrders} — all default to this module's
 * own singletons. `transitEstimator`/`processingEstimator`/
 * `materialsEstimator` are swappable for a future implementation without
 * this orchestration changing (6-order-scheduling.md §5); `executionStarter`
 * likewise for testing without a real Step Functions call.
 */
export interface OrderSchedulingDeps {
  orderDao?: OrderDao;
  requestDao?: RequestDao;
  locationDao?: LocationDao;
  operatorDao?: OperatorDao;
  transitEstimator?: TransitTimeEstimator;
  processingEstimator?: ProcessingTimeEstimator;
  materialsEstimator?: MaterialsCostEstimator;
  executionStarter?: OrderExecutionStarter;
  /** Cleanup when a claimed vehicle can't be handed off — injectable for tests. */
  failExecution?: typeof failExecution;
  now?: () => Date;
  /** Reads DISPATCH_POLICY once per pass (20-ml-driver-assignment.md §3.1). */
  resolveDispatchPolicy?: typeof resolveDispatchPolicy;
  /** Publishes one dispatch_decisions row per committed assignment (§2.4). */
  recordDispatchDecision?: typeof recordDispatchDecision;
  newRunId?: () => string;
}

export interface ScheduleOrdersOptions {
  /** What started this pass; only the hourly SCHEDULE exists until Leg 1b. */
  trigger?: DispatchTrigger;
}

/* Per-decision context the pass hands each dispatch: its stamp, and the waiting orders it was chosen from. */
interface DispatchContext {
  stamp: DispatchStamp;
  /** This order first, then the ones queued behind it in the pass, capped at MAX_CONSIDERED_ORDERS. */
  consideredOrders: Order[];
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
      | "orderDao"
      | "requestDao"
      | "locationDao"
      | "operatorDao"
      | "transitEstimator"
      | "processingEstimator"
      | "materialsEstimator"
      | "executionStarter"
      | "failExecution"
      | "now"
      | "recordDispatchDecision"
    >
  >,
  context: DispatchContext
): Promise<"SCHEDULED" | "SKIPPED_NO_CAPACITY"> {
  logInfo("OrderScheduleAttemptStarted", { orderId: order.order_id });

  /*
   * Evaluation rejects every Order without a location, so one in SCHEDULE
   * is a data anomaly. Checked before claiming an Operator so it can't
   * strand a truck; the caller's per-order isolation counts it as failed.
   */
  const locationId = order.location_id;
  if (locationId === null) {
    throw new Error(`Order ${order.order_id} reached SCHEDULE with no location_id`);
  }

  const idleOperator = await deps.operatorDao.findIdleOperator();
  if (!idleOperator) {
    logInfo("OrderScheduleSkippedNoCapacity", { orderId: order.order_id });
    return "SKIPPED_NO_CAPACITY";
  }

  const [request, location] = await Promise.all([
    deps.requestDao.getRequestById(order.request_id),
    deps.locationDao.getLocation(locationId),
  ]);
  if (!request || !location) {
    throw new Error(`Order ${order.order_id} has no resolvable Request/Location record`);
  }

  const jobLocation = resolveJobLocation(location);
  const locationIsFallback = jobLocation === HOME_DEPOT_LOCATION;
  /* Should never be null in practice — every Operator is stamped with HOME_DEPOT_LOCATION at OPERATOR_ADDED — but the schema allows it, so this is defended rather than assumed. */
  const operatorLocation = idleOperator.current_location ?? HOME_DEPOT_LOCATION;

  const [transitMinutes, processingMinutes, materialsCostEstimate, distanceMiles] = await Promise.all([
    deps.transitEstimator.estimateMinutes(operatorLocation, jobLocation),
    deps.processingEstimator.estimateMinutes(order, request),
    deps.materialsEstimator.estimateCost(order, request),
    getDistance(operatorLocation, jobLocation),
  ]);
  logInfo("OrderScheduleEstimated", {
    orderId: order.order_id,
    operatorId: idleOperator.operator_id,
    dispatchPolicy: context.stamp.dispatch_policy,
    plannerRunId: context.stamp.planner_run_id,
    distanceMiles,
    locationIsFallback,
    descriptor: request.descriptor,
    transitMinutes,
    processingMinutes,
    materialsCostEstimate,
    costModel: deps.materialsEstimator.costModel,
  });

  const scheduledStart = deps.now();
  const scheduledEnd = new Date(scheduledStart.getTime() + (transitMinutes + processingMinutes) * 60 * 1000);

  /*
   * The scheduling job's own claim performs the idle->busy transition
   * (§3.6) — not deferred to the execution state machine's Dispatch
   * Task, so a later Order in this same run never sees this Operator as
   * idle again.
   */
  try {
    await deps.operatorDao.startTransit(idleOperator.operator_id, context.stamp);
  } catch (err) {
    /* A10: another run claimed this vehicle first. The Order stays in SCHEDULE for the next run. */
    if (err instanceof ConflictError) {
      logInfo("OrderScheduleSkippedOperatorClaimConflict", { orderId: order.order_id, operatorId: idleOperator.operator_id });
      return "SKIPPED_NO_CAPACITY";
    }
    throw err;
  }

  /*
   * Once the vehicle is claimed, a failure to hand off must not strand it
   * (v1-prod-deployment.md Q3/F6): run the same cleanup as a failed
   * execution, then rethrow so the run counts this Order as failed.
   */
  try {
    await deps.orderDao.scheduleOrder(order.order_id, {
      scheduledStart: scheduledStart.toISOString(),
      scheduledEnd: scheduledEnd.toISOString(),
      operatorId: idleOperator.operator_id,
      materialsCostEstimate,
      costModel: deps.materialsEstimator.costModel,
      dispatch: context.stamp,
    });

    await deps.executionStarter.startExecution({
      orderId: order.order_id,
      operatorId: idleOperator.operator_id,
      jobLocation,
      scheduledStartDatetime: scheduledStart.toISOString(),
    });
  } catch (err) {
    const reason = `Hand-off after claim failed: ${err instanceof Error ? err.message : String(err)}`;
    logWarn("OrderScheduleHandOffFailed", { orderId: order.order_id, operatorId: idleOperator.operator_id, reason });
    await deps.failExecution(order.order_id, idleOperator.operator_id, reason, {
      orderDao: deps.orderDao,
      operatorDao: deps.operatorDao,
    });
    throw err;
  }

  logInfo("OrderScheduled", {
    orderId: order.order_id,
    operatorId: idleOperator.operator_id,
    scheduledStart: scheduledStart.toISOString(),
    scheduledEnd: scheduledEnd.toISOString(),
  });

  /* Under C the pass takes orders oldest-first, so the chosen order is always rank 1 of its considered set. */
  await deps.recordDispatchDecision({
    planner_run_id: context.stamp.planner_run_id,
    decided_at: scheduledStart.toISOString(),
    dispatch_policy: context.stamp.dispatch_policy,
    trigger: context.stamp.trigger,
    model_version: context.stamp.model_version,
    decision_type: "ASSIGN",
    operator_id: idleOperator.operator_id,
    order_id: order.order_id,
    considered_order_ids: JSON.stringify(context.consideredOrders.map((considered) => considered.order_id)),
    considered_count: context.consideredOrders.length,
    order_age_rank: 1,
    location_is_fallback: locationIsFallback,
    distance_miles: distanceMiles,
    predicted_transit_minutes: transitMinutes,
    predicted_work_minutes: processingMinutes,
    edge_cost: null,
    wait_for_operator_id: null,
    expected_free_at: null,
    predicted_saving_minutes: null,
    recheck_at: null,
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
export async function scheduleOrders(
  deps: OrderSchedulingDeps = {},
  options: ScheduleOrdersOptions = {}
): Promise<SchedulingRunSummary> {
  const resolvedDeps = {
    orderDao: deps.orderDao ?? getOrderDao(),
    requestDao: deps.requestDao ?? getRequestDao(),
    locationDao: deps.locationDao ?? getLocationDao(),
    operatorDao: deps.operatorDao ?? getOperatorDao(),
    transitEstimator: deps.transitEstimator ?? straightLineTransitTimeEstimator,
    processingEstimator: deps.processingEstimator ?? streetConditionProcessingTimeEstimator,
    materialsEstimator: deps.materialsEstimator ?? streetConditionMaterialsCostEstimator,
    executionStarter: deps.executionStarter ?? stepFunctionsOrderExecutionStarter,
    failExecution: deps.failExecution ?? failExecution,
    now: deps.now ?? (() => new Date()),
    recordDispatchDecision: deps.recordDispatchDecision ?? recordDispatchDecision,
  };

  const plannerRunId = (deps.newRunId ?? randomUUID)();
  const trigger = options.trigger ?? "SCHEDULE";
  const { appliedPolicy } = await (deps.resolveDispatchPolicy ?? resolveDispatchPolicy)();
  const stamp: DispatchStamp = { dispatch_policy: appliedPolicy, planner_run_id: plannerRunId, trigger, model_version: null };

  logInfo("OrderSchedulingRunStarted", { plannerRunId, trigger, dispatchPolicy: appliedPolicy });

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

    for (const [index, order] of page.orders.entries()) {
      summary.ordersConsidered += 1;
      try {
        const consideredOrders = page.orders.slice(index, index + MAX_CONSIDERED_ORDERS);
        const outcome = await dispatchOneOrder(order, resolvedDeps, { stamp, consideredOrders });
        if (outcome === "SCHEDULED") summary.ordersScheduled += 1;
        else summary.ordersSkippedNoCapacity += 1;
      } catch (err) {
        summary.ordersFailed += 1;
        logWarn("OrderScheduleFailed", { orderId: order.order_id, error: err instanceof Error ? err.message : err });
      }
    }

    cursor = page.nextCursor;
  } while (cursor && summary.ordersConsidered < MAX_ORDERS_PER_RUN);

  logInfo("OrderSchedulingRunCompleted", { summary, plannerRunId, dispatchPolicy: appliedPolicy });
  return summary;
}
