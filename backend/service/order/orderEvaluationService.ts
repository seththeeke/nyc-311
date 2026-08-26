import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { logInfo, logWarn } from "../../logger";
import { OrderDao } from "../../dao/order/orderDao";
import { createCase } from "../case/caseService";
import type { Order, OrderEvent } from "../../models/order";
import type { OrderStreamRecord } from "../../models/orderStreamEvent";
import { MockOrderPriorityAssigner, type OrderPriorityAssigner } from "./orderPriorityService";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/* Constructed lazily inside evaluateOrder, not at module scope — per CLAUDE.md §5.2 (revised 2026-08-22). */
function getDefaultOrderDao(): OrderDao {
  return new OrderDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), requireEnv("ORDERS_TABLE_NAME"));
}

/**
 * Dependencies for {@link fanOutOrderEvent}. Both default to a freshly
 * constructed client/env lookup — tests override them with mocks/fakes.
 */
export interface OrderEventFanOutDeps {
  snsClient?: SNSClient;
  topicArn?: string;
}

/**
 * True only for an appended `OrderEvent` (an `INSERT` whose `sk` starts
 * with `EVENT#`) — never the `#METADATA` projection item, per
 * `5-order-evaluation.md` §3's "forward every OrderEvent, not just
 * creation" decision. The projection's own writes are always either an
 * `INSERT` of `#METADATA` (creation) or a `MODIFY` (every later update) —
 * neither matches this check, so the fan-out only ever forwards Order's
 * source-of-truth event log, never its derived, read-optimized cache.
 */
function isOrderEventRecord(record: OrderStreamRecord): boolean {
  if (record.eventName !== "INSERT") return false;
  const sk = record.dynamodb.NewImage?.["sk"];
  return (
    typeof sk === "object" &&
    sk !== null &&
    "S" in sk &&
    typeof (sk as { S: unknown }).S === "string" &&
    (sk as { S: string }).S.startsWith("EVENT#")
  );
}

/**
 * Fans out one appended `OrderEvent` onto `Nyc311OrderEventsTopic`, tagged
 * with an `event_type` message attribute so downstream SQS subscriptions
 * can filter declaratively (`5-order-evaluation.md` §3) — no relevance
 * logic lives past this Lambda; everything downstream is a filter policy,
 * not code. No DAO calls, same "pure plumbing" shape as
 * `nyc311RequestService.ts`'s `fanOutRequestRecord`. An irrelevant record
 * is a normal no-op, never a `batchItemFailure`.
 */
export async function fanOutOrderEvent(record: OrderStreamRecord, deps: OrderEventFanOutDeps = {}): Promise<void> {
  const snsClient = deps.snsClient ?? new SNSClient({});
  const topicArn = deps.topicArn ?? requireEnv("ORDER_EVENTS_TOPIC_ARN");

  if (!isOrderEventRecord(record)) {
    logInfo("OrderStreamRecordSkipped", {
      eventName: record.eventName,
      sequenceNumber: record.dynamodb.SequenceNumber,
    });
    return;
  }

  const orderEvent = unmarshall(record.dynamodb.NewImage as Record<string, AttributeValue>);
  const eventType = typeof orderEvent["event_type"] === "string" ? orderEvent["event_type"] : "UNKNOWN";
  logInfo("OrderStreamRecordUnmarshalled", {
    sequenceNumber: record.dynamodb.SequenceNumber,
    orderId: orderEvent["order_id"],
    eventType,
  });

  await snsClient.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(orderEvent),
      MessageAttributes: {
        event_type: { DataType: "String", StringValue: eventType },
      },
    })
  );
  logInfo("OrderStreamRecordFannedOut", {
    sequenceNumber: record.dynamodb.SequenceNumber,
    orderId: orderEvent["order_id"],
    eventType,
  });
}

/**
 * Pluggable interface (`5-order-evaluation.md` §1/§2), same pattern as
 * `LocationResolver`/`OrderPriorityAssigner` — a real future implementation
 * (a business rules engine) swaps in without changing callers. A real
 * three-outcome contract, not two outcomes plus an error-path fallback —
 * `CASE` means "no rule applies," distinct from `REJECT` ("a rule fired
 * and said no").
 */
export type OrderEvaluationOutcome = "ACCEPT" | "REJECT" | "CASE";

export interface OrderEvaluationRule {
  evaluate(order: Order): Promise<OrderEvaluationOutcome>;
}

/** Fixed split (§2) — 80% ACCEPT, 19% REJECT, 1% CASE. */
const ACCEPT_THRESHOLD = 0.8;
const REJECT_THRESHOLD = 0.99;

export interface RandomOrderEvaluationRuleDeps {
  random?: () => number;
}

/**
 * v1 (mock) implementation: a single random-number draw, fixed split, no
 * inspection of the `Order` at all — proves the three-outcome contract and
 * the event-recording/Case-handoff plumbing without deciding any real
 * business rule, same "stub proves the shape" pattern as every other mock
 * interface in this project.
 */
export class RandomOrderEvaluationRule implements OrderEvaluationRule {
  private readonly random: () => number;

  constructor(deps: RandomOrderEvaluationRuleDeps = {}) {
    this.random = deps.random ?? Math.random;
  }

  async evaluate(): Promise<OrderEvaluationOutcome> {
    const draw = this.random();
    if (draw < ACCEPT_THRESHOLD) return "ACCEPT";
    if (draw < REJECT_THRESHOLD) return "REJECT";
    return "CASE";
  }
}

/**
 * Dependencies for {@link evaluateOrder} — all default to this module's own
 * singletons/mocks.
 */
export interface OrderEvaluationDeps {
  orderDao?: OrderDao;
  rule?: OrderEvaluationRule;
  priorityAssigner?: OrderPriorityAssigner;
  createCaseFn?: typeof createCase;
}

/**
 * Evaluates one `OrderEvent` off the (filtered-to-`ORDER_CREATED`)
 * evaluation queue (`5-order-evaluation.md` §1/§6) — re-fetches the
 * Order's current projection rather than trusting the queue message, and
 * no-ops if it's already been evaluated. The check can't be
 * `status === "CREATED"` alone: a `CASE` outcome leaves `status`
 * unchanged, so idempotency also requires `case_id === null`.
 */
export async function evaluateOrder(orderEvent: OrderEvent, deps: OrderEvaluationDeps = {}): Promise<void> {
  const orderDao = deps.orderDao ?? getDefaultOrderDao();
  const rule = deps.rule ?? new RandomOrderEvaluationRule();
  const priorityAssigner = deps.priorityAssigner ?? new MockOrderPriorityAssigner();
  const createCaseFn = deps.createCaseFn ?? createCase;

  logInfo("OrderEvaluationStarted", { orderId: orderEvent.order_id });

  const order = await orderDao.getOrder(orderEvent.order_id);
  if (!order) {
    logWarn("OrderEvaluationOrderNotFound", { orderId: orderEvent.order_id });
    return;
  }
  if (order.status !== "CREATED" || order.case_id !== null) {
    logInfo("OrderEvaluationSkippedAlreadyProcessed", {
      orderId: order.order_id,
      status: order.status,
      caseId: order.case_id,
    });
    return;
  }

  const outcome = await rule.evaluate(order);
  logInfo("OrderEvaluationOutcomeDecided", { orderId: order.order_id, outcome });

  if (outcome === "ACCEPT") {
    const { priorityTier, slaDeadline } = await priorityAssigner.assign(order);
    await orderDao.acceptOrder(order.order_id, { priorityTier, slaDeadline });
  } else if (outcome === "REJECT") {
    await orderDao.rejectOrder(order.order_id, "Rejected by evaluation rule");
  } else {
    await createCaseFn({
      case_type: "WORKFLOW_EXECUTION_FAILURE",
      request_id: null,
      order_id: order.order_id,
      reason: "Evaluation rule had no basis to accept or reject this Order",
    });
    await orderDao.recordCaseCreated(order.order_id, "No applicable evaluation rule");
  }

  logInfo("OrderEvaluationCompleted", { orderId: order.order_id, outcome });
}
