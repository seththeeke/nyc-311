import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { logInfo } from "../../logger";
import { OrderDao } from "../../dao/order/orderDao";
import { OperatorDao } from "../../dao/operator/operatorDao";
import type { GpsLocation } from "../../models/gpsLocation";
import type { DispatchResult } from "../../models/orderExecutionTask";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/* Constructed lazily inside each exported function, not at module scope — per CLAUDE.md §5.2. */
function getDefaultOrderDao(): OrderDao {
  return new OrderDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), requireEnv("ORDERS_TABLE_NAME"));
}
function getDefaultOperatorDao(): OperatorDao {
  return new OperatorDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), requireEnv("OPERATORS_TABLE_NAME"));
}

/**
 * How much faster the simulation runs than real time
 * (`10-capacity-modeling-and-integration.md` §3.3) — `100` compresses a
 * 20-minute transit estimate into a 12-second `Wait`, `1` is real time.
 * A plain env var for this leg, not AWS AppConfig as §3.3 originally
 * proposed — nothing yet needs to change the scale without a redeploy;
 * swapping to AppConfig later is a drop-in change behind this same
 * function, not a state-machine redesign.
 */
function getSimulationTimeScale(): number {
  const raw = process.env.SIMULATION_TIME_SCALE;
  const parsed = raw ? Number(raw) : 1;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export interface OrderExecutionDeps {
  orderDao?: OrderDao;
  operatorDao?: OperatorDao;
  getSimulationTimeScale?: () => number;
}

/**
 * The execution state machine's `Dispatch` phase
 * (`10-capacity-modeling-and-integration.md` §3.2/§3.6) — fires
 * `ORDER_DISPATCHED` only; the assigned Operator already transitioned to
 * `TRANSIT` when the scheduling job claimed it, so no Operator event
 * fires here. Returns the scaled `Wait` durations the state machine's
 * next two `Wait` states read.
 */
export async function dispatchOrder(
  orderId: string,
  transitMinutes: number,
  processingMinutes: number,
  deps: OrderExecutionDeps = {}
): Promise<DispatchResult> {
  const orderDao = deps.orderDao ?? getDefaultOrderDao();
  const scale = (deps.getSimulationTimeScale ?? getSimulationTimeScale)();

  logInfo("OrderExecutionDispatchStarted", { orderId, transitMinutes, processingMinutes, scale });
  await orderDao.recordDispatched(orderId);

  const result: DispatchResult = {
    transit_wait_seconds: Math.round((transitMinutes * 60) / scale),
    processing_wait_seconds: Math.round((processingMinutes * 60) / scale),
  };
  logInfo("OrderExecutionDispatchCompleted", { orderId, ...result });
  return result;
}

/**
 * The `Arrive` phase — vehicle reached the job location. Fires
 * `ORDER_ARRIVED`/`WORK_STARTED` (the arrival GPS ping), then
 * `ORDER_PROCESSING` immediately after — on-site work begins the moment
 * of arrival, no separate Wait modeled between the two (§3.2).
 */
export async function arriveAtJob(
  orderId: string,
  operatorId: string,
  jobLocation: GpsLocation,
  deps: OrderExecutionDeps = {}
): Promise<void> {
  const orderDao = deps.orderDao ?? getDefaultOrderDao();
  const operatorDao = deps.operatorDao ?? getDefaultOperatorDao();

  logInfo("OrderExecutionArriveStarted", { orderId, operatorId });
  await orderDao.recordArrived(orderId);
  await operatorDao.startWork(operatorId, jobLocation);
  await orderDao.recordProcessing(orderId);
  logInfo("OrderExecutionArriveCompleted", { orderId, operatorId });
}

/**
 * The `Process/Resolve` phase's terminal step — on-site work finished.
 * Fires `ORDER_RESOLVED`/`WORK_COMPLETED`, then finalizes the Operator's
 * removal if one was queued while it was busy (§1.1) — a separate,
 * conditional second Operator event, same two-step precedent
 * `removeCapacity` already uses.
 */
export async function resolveOrder(orderId: string, operatorId: string, deps: OrderExecutionDeps = {}): Promise<void> {
  const orderDao = deps.orderDao ?? getDefaultOrderDao();
  const operatorDao = deps.operatorDao ?? getDefaultOperatorDao();

  logInfo("OrderExecutionResolveStarted", { orderId, operatorId });
  await orderDao.recordResolved(orderId);
  const operator = await operatorDao.completeWork(operatorId);

  if (operator.removal_requested_at) {
    logInfo("OrderExecutionFinalizingQueuedRemoval", { operatorId });
    await operatorDao.finalizeRemoval(operatorId);
  }
  logInfo("OrderExecutionResolveCompleted", { orderId, operatorId });
}
