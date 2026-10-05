import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { logInfo, logWarn } from "../../logger";
import { requireEnv } from "../../env";
import { OrderDao } from "../../dao/order/orderDao";
import { createCase } from "../case/caseService";
import type { Order, OrderEvent, OrderRejectionReasonCode } from "../../models/order";
import type { OrderStreamRecord } from "../../models/orderStreamEvent";
import { MockOrderPriorityAssigner, type OrderPriorityAssigner } from "./orderPriorityService";

/* Constructed lazily inside evaluateOrder, not at module scope — per CLAUDE.md §5.2 (revised 2026-08-22). */
function getDefaultOrderDao(): OrderDao {
  return new OrderDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), requireEnv("ORDERS_TABLE_NAME"));
}

/**
 * Dependencies for {@link fanOutOrdersStreamRecord}. All default to a
 * freshly constructed client/env lookup — tests override them with
 * mocks/fakes.
 */
export interface OrdersStreamFanOutDeps {
  snsClient?: SNSClient;
  eventsTopicArn?: string;
  projectionsTopicArn?: string;
}

/** Extracts a string `sk` from a stream record's `NewImage`, or `null`. */
function newImageSk(record: OrderStreamRecord): string | null {
  const sk = record.dynamodb.NewImage?.["sk"];
  if (typeof sk === "object" && sk !== null && "S" in sk && typeof (sk as { S: unknown }).S === "string") {
    return (sk as { S: string }).S;
  }
  return null;
}

/**
 * True only for an appended `OrderEvent` — an `INSERT` whose `sk` starts
 * with `EVENT#` (`5-order-evaluation.md` §3). Immutable, append-only, so a
 * `MODIFY` never applies here.
 */
function isOrderEventRecord(record: OrderStreamRecord): boolean {
  return record.eventName === "INSERT" && (newImageSk(record)?.startsWith("EVENT#") ?? false);
}

/**
 * True for a change to the `#METADATA` projection row — an `INSERT` (order
 * creation) or a `MODIFY` (every later state transition). Only the
 * warehouse consumes this stream (`7-data-warehousing.md` §4), for
 * `order_snapshots`; the operational Order-evaluation pipeline reads
 * `Nyc311OrderEventsTopic` instead.
 */
function isOrderProjectionRecord(record: OrderStreamRecord): boolean {
  return (
    (record.eventName === "INSERT" || record.eventName === "MODIFY") && newImageSk(record) === "#METADATA"
  );
}

/**
 * Routes one `Orders`-table stream record: an `EVENT#` item onto
 * `Nyc311OrderEventsTopic` (tagged `event_type`, unchanged from
 * `5-order-evaluation.md` §3), a `#METADATA` change onto
 * `Nyc311OrderProjectionsTopic` (tagged `event_name`), everything else a
 * no-op (`7-data-warehousing.md` §4). One stream reader, two outbound
 * topics — pure plumbing, no DAO calls, an irrelevant record never a
 * `batchItemFailure`.
 */
export async function fanOutOrdersStreamRecord(
  record: OrderStreamRecord,
  deps: OrdersStreamFanOutDeps = {}
): Promise<void> {
  const snsClient = deps.snsClient ?? new SNSClient({});

  if (isOrderEventRecord(record)) {
    const eventsTopicArn = deps.eventsTopicArn ?? requireEnv("ORDER_EVENTS_TOPIC_ARN");
    const orderEvent = unmarshall(record.dynamodb.NewImage as Record<string, AttributeValue>);
    const eventType = typeof orderEvent["event_type"] === "string" ? orderEvent["event_type"] : "UNKNOWN";
    logInfo("OrderStreamRecordUnmarshalled", {
      sequenceNumber: record.dynamodb.SequenceNumber,
      orderId: orderEvent["order_id"],
      recordType: "EVENT",
      eventType,
    });
    await snsClient.send(
      new PublishCommand({
        TopicArn: eventsTopicArn,
        Message: JSON.stringify(orderEvent),
        MessageAttributes: { event_type: { DataType: "String", StringValue: eventType } },
      })
    );
    logInfo("OrderStreamRecordFannedOut", {
      sequenceNumber: record.dynamodb.SequenceNumber,
      orderId: orderEvent["order_id"],
      recordType: "EVENT",
      eventType,
    });
    return;
  }

  if (isOrderProjectionRecord(record)) {
    const projectionsTopicArn = deps.projectionsTopicArn ?? requireEnv("ORDER_PROJECTIONS_TOPIC_ARN");
    const projection = unmarshall(record.dynamodb.NewImage as Record<string, AttributeValue>);
    logInfo("OrderStreamRecordUnmarshalled", {
      sequenceNumber: record.dynamodb.SequenceNumber,
      orderId: projection["order_id"],
      recordType: "PROJECTION",
      eventName: record.eventName,
    });
    await snsClient.send(
      new PublishCommand({
        TopicArn: projectionsTopicArn,
        /* event_name in the body too: raw SNS delivery drops attributes, so this is how it reaches the warehouse (#37). */
        Message: JSON.stringify({ ...projection, event_name: record.eventName }),
        MessageAttributes: { event_name: { DataType: "String", StringValue: record.eventName } },
      })
    );
    logInfo("OrderStreamRecordFannedOut", {
      sequenceNumber: record.dynamodb.SequenceNumber,
      orderId: projection["order_id"],
      recordType: "PROJECTION",
      eventName: record.eventName,
    });
    return;
  }

  logInfo("OrderStreamRecordSkipped", {
    eventName: record.eventName,
    sequenceNumber: record.dynamodb.SequenceNumber,
  });
}

/**
 * Pluggable interface (`5-order-evaluation.md` §1/§2), same pattern as
 * `LocationResolver`/`OrderPriorityAssigner` — a real future implementation
 * (a business rules engine) swaps in without changing callers. A real
 * three-outcome contract, not two outcomes plus an error-path fallback —
 * `CASE` means "no rule applies," distinct from `REJECT` ("a rule fired
 * and said no"), which always says why.
 */
export type OrderEvaluationOutcome = "ACCEPT" | "REJECT" | "CASE";

export type OrderEvaluationResult =
  | { readonly outcome: "ACCEPT" }
  | { readonly outcome: "REJECT"; readonly reasonCode: OrderRejectionReasonCode }
  | { readonly outcome: "CASE" };

export interface OrderEvaluationRule {
  evaluate(order: Order): Promise<OrderEvaluationResult>;
}

/* The one complaint type this system now services (11-street-condition-implementation.md §1). */
const STREET_CONDITION_COMPLAINT_TYPE = "Street Condition";

/**
 * v1 real implementation (11-street-condition-implementation.md §1,
 * v1-prod-deployment.md Q2): rejects anything but "Street Condition" as
 * `SERVICE_NOT_SUPPORTED`, then a Street Condition Order with no resolved
 * location as `LOCATION_UNRESOLVED`; accepts the rest. Service type is
 * checked first so the location-miss rate reflects serviceable work only.
 */
export class StreetConditionOnlyRule implements OrderEvaluationRule {
  async evaluate(order: Order): Promise<OrderEvaluationResult> {
    if (order.complaint_type !== STREET_CONDITION_COMPLAINT_TYPE) {
      return { outcome: "REJECT", reasonCode: "SERVICE_NOT_SUPPORTED" };
    }
    if (order.location_id === null) {
      return { outcome: "REJECT", reasonCode: "LOCATION_UNRESOLVED" };
    }
    return { outcome: "ACCEPT" };
  }
}

/* Human-readable `reason` alongside each code, for the event log. */
const REJECTION_REASONS: Record<OrderRejectionReasonCode, string> = {
  SERVICE_NOT_SUPPORTED: "Complaint type is not a supported service",
  LOCATION_UNRESOLVED: "Request had no resolvable location",
};

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
  const rule = deps.rule ?? new StreetConditionOnlyRule();
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

  const result = await rule.evaluate(order);
  logInfo("OrderEvaluationOutcomeDecided", { orderId: order.order_id, result });

  if (result.outcome === "ACCEPT") {
    const { priorityTier, slaDeadline } = await priorityAssigner.assign(order);
    await orderDao.acceptOrder(order.order_id, { priorityTier, slaDeadline });
  } else if (result.outcome === "REJECT") {
    await orderDao.rejectOrder(order.order_id, result.reasonCode, REJECTION_REASONS[result.reasonCode]);
  } else {
    await createCaseFn({
      case_type: "WORKFLOW_EXECUTION_FAILURE",
      request_id: null,
      order_id: order.order_id,
      reason: "Evaluation rule had no basis to accept or reject this Order",
    });
    await orderDao.recordCaseCreated(order.order_id, "No applicable evaluation rule");
  }

  logInfo("OrderEvaluationCompleted", { orderId: order.order_id, result });
}
