import { ulid } from "ulid";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { EventSourcedDao } from "../dao";
import { logInfo } from "../../logger";
import type { CostModel, Order, OrderEvent, OrderEventType, OrderRejectionReasonCode, OrderStage } from "../../models/order";
import { OrderSchema, OrderEventSchema, ORDER_STAGES } from "../../models/order";
import type { OrderListResult } from "../../models/orderListResult";
import { ValidationError } from "../../models/errors";

export interface CreateOrderInput {
  request_id: string;
  location_id: string | null;
  complaint_type: string | null;
}

export interface AcceptOrderInput {
  priorityTier: string;
  slaDeadline: string;
}

export interface ScheduleOrderInput {
  scheduledStart: string;
  scheduledEnd: string;
  operatorId: string;
  /** Expected materials cost in USD, from the MaterialsCostEstimator (v1-prod-deployment.md Q5). */
  materialsCostEstimate: number;
  costModel: CostModel;
}

export interface ListOrdersWaitingForScheduleOptions {
  limit: number;
  cursor?: string | null;
}

export interface OperatorOrderActivity {
  /** The Order this Operator is currently executing (`current_stage === "EXECUTE"`), or `null` if idle/none. */
  currentOrder: Order | null;
  /** This Operator's last `RECENT_JOBS_LIMIT` completed (`RESOLVE`) Orders, most-recent-first. */
  recentCompletedOrders: Order[];
}

/* "STAGE#" + current_stage — gsi1-stage-sla's partition key, per ddb-design.md. */
const STAGE_SLA_INDEX = "gsi1-stage-sla";
function stageSlaPartitionKey(stage: OrderStage): string {
  return `STAGE#${stage}`;
}

/* gsi2pk = assigned_operator_id, gsi2sk = updated_at, per ddb-design.md — "Orders currently assigned to a given Operator". */
const ASSIGNED_OPERATOR_INDEX = "gsi2-assigned-operator";
/*
 * The one place an Order's GSI keys come from. Every append fully replaces
 * the projection item, so the keys are derived from the new projection on
 * every write (via appendOrderEvent) rather than per method; a method that
 * forgot them used to silently drop the Order from both indexes. Both
 * indexes are sparse: gsi1 needs sla_deadline (set from acceptOrder on),
 * gsi2 an assigned operator. A REJECTED Order is in neither, so it can
 * never be picked off the scheduling queue.
 */
function orderIndexAttributes(projection: Order): Record<string, unknown> {
  if (projection.status === "REJECTED") return {};
  return {
    ...(projection.sla_deadline
      ? { gsi1pk: stageSlaPartitionKey(projection.current_stage), gsi1sk: projection.sla_deadline }
      : {}),
    ...(projection.assigned_operator_id
      ? { gsi2pk: projection.assigned_operator_id, gsi2sk: projection.updated_at }
      : {}),
  };
}
/*
 * Over-fetches past RECENT_JOBS_LIMIT (11-street-condition-implementation.md
 * §7) to absorb in-progress Orders (SCHEDULE/EXECUTE, still gsi2-current)
 * that would otherwise crowd a pure recency sort ahead of completed
 * (RESOLVE) ones.
 */
const RECENT_JOBS_OVER_FETCH_LIMIT = 20;
const RECENT_JOBS_LIMIT = 5;

/* Opaque pagination cursor = base64url(JSON(DynamoDB LastEvaluatedKey)) — round-tripped by the caller, never inspected. */
function encodeCursor(key: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(key), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch (err) {
    throw new ValidationError("Malformed Order list cursor", err);
  }
}

export class OrderDao extends EventSourcedDao<Order, OrderEvent> {
  constructor(client: DynamoDBDocumentClient, tableName: string) {
    super(client, tableName, OrderSchema, OrderEventSchema, "order_id");
  }

  /**
   * Creates a new Order in its first state (`3-order-ingestion.md` §5) —
   * `current_stage: "INGEST"`, everything workflow-derived (priority,
   * schedule, assignment) still null/zero until `5-order-evaluation.md`'s
   * state machine actually runs. Does not start that state machine —
   * it doesn't exist yet.
   */
  async createOrder(input: CreateOrderInput): Promise<Order> {
    const orderId = ulid();
    return this.appendOrderEvent(
      orderId,
      "ORDER_CREATED",
      null,
      { request_id: input.request_id, location_id: input.location_id, complaint_type: input.complaint_type },
      (_previous, event) => ({
        order_id: orderId,
        request_id: input.request_id,
        location_id: input.location_id,
        complaint_type: input.complaint_type,
        current_stage: "INGEST",
        status: "CREATED",
        retry_counts: Object.fromEntries(ORDER_STAGES.map((stage) => [stage, 0])) as Record<string, number>,
        priority_tier: null,
        sla_deadline: null,
        scheduled_start: null,
        scheduled_end: null,
        assigned_operator_id: null,
        reassignment_count: 0,
        case_id: null,
        created_at: event.occurred_at,
        updated_at: event.occurred_at,
        last_event_sequence: event.sequence_number,
      })
    );
  }

  /** Fetches the current Order projection, or `null` if this order_id has no events yet. */
  async getOrder(orderId: string): Promise<Order | null> {
    return this.getProjection(orderId);
  }

  /**
   * Records an evaluation `ACCEPT` outcome (`5-order-evaluation.md` §1/§4):
   * appends `ORDER_ACCEPTED`, moving `current_stage` to `SCHEDULE` — the
   * hand-off to the dispatch queue `gsi1-stage-sla` was built for — and
   * `status` to `ACTIVE`, stamping the (today, mocked) `priority_tier`/
   * `sla_deadline` in the same event/fold rather than a separate
   * `PriorityAssigned` append, so the transition is one atomic write, not
   * two (a crash between two appends would leave the Order half-accepted).
   *
   * @throws {@link ValidationError} if no projection exists yet for
   * `orderId` — this outcome only ever follows a real `OrderCreated`.
   */
  async acceptOrder(orderId: string, input: AcceptOrderInput): Promise<Order> {
    /* First point sla_deadline is non-null, so the Order enters gsi1-stage-sla here (6-order-scheduling.md §2). */
    return this.appendToExistingOrder(
      orderId,
      "ORDER_ACCEPTED",
      null,
      { priority_tier: input.priorityTier, sla_deadline: input.slaDeadline },
      () => ({
        current_stage: "SCHEDULE",
        status: "ACTIVE",
        priority_tier: input.priorityTier,
        sla_deadline: input.slaDeadline,
      })
    );
  }

  /**
   * Records an evaluation `REJECT` outcome (`5-order-evaluation.md` §1/§4):
   * appends `ORDER_REJECTED`, terminal — `status: "REJECTED"`,
   * `current_stage` stays wherever it already was (never advanced).
   * `reasonCode` lands in the event payload for the warehouse's rejection
   * funnel (v1-prod-deployment.md Q2).
   */
  async rejectOrder(orderId: string, reasonCode: OrderRejectionReasonCode, reason: string): Promise<Order> {
    return this.appendToExistingOrder(orderId, "ORDER_REJECTED", null, { reason_code: reasonCode, reason }, () => ({
      status: "REJECTED",
    }));
  }

  /**
   * Records an evaluation `CASE` outcome (`5-order-evaluation.md` §1/§4/§5):
   * appends `CASE_CREATED` for audit purposes. Deliberately does **not**
   * stamp `Order.case_id` — real Case persistence doesn't exist yet (§5),
   * same "don't fabricate an FK to nothing" precedent
   * `3-order-ingestion.md`'s `resolveLocation` already set. `status`/
   * `current_stage` stay put — a Case is an orthogonal signal, not a status.
   */
  async recordCaseCreated(orderId: string, reason: string): Promise<Order> {
    return this.appendToExistingOrder(orderId, "CASE_CREATED", null, { reason }, () => ({}));
  }

  /**
   * Records a successful dispatch (`6-order-scheduling.md` §7): appends a
   * single `ORDER_SCHEDULED` event carrying the computed window *and* the
   * assigned operator, moving `current_stage` from `SCHEDULE` to `EXECUTE`.
   * One merged event, not a separate `ORDER_ASSIGNED` append — same
   * one-atomic-write reasoning `acceptOrder` already applied to merging
   * `PriorityAssigned` into `ORDER_ACCEPTED`. `ORDER_ASSIGNED` stays
   * reserved for a genuine future reassignment.
   */
  async scheduleOrder(orderId: string, input: ScheduleOrderInput): Promise<Order> {
    /* First point assigned_operator_id is non-null, so the Order enters gsi2-assigned-operator here (11-street-condition-implementation.md §7). */
    return this.appendToExistingOrder(
      orderId,
      "ORDER_SCHEDULED",
      "SCHEDULE",
      {
        scheduled_start: input.scheduledStart,
        scheduled_end: input.scheduledEnd,
        operator_id: input.operatorId,
        materials_cost_estimate: input.materialsCostEstimate,
        cost_model: input.costModel,
      },
      () => ({
        current_stage: "EXECUTE",
        scheduled_start: input.scheduledStart,
        scheduled_end: input.scheduledEnd,
        assigned_operator_id: input.operatorId,
        estimated_materials_cost: input.materialsCostEstimate,
        cost_model_used: input.costModel,
      })
    );
  }

  /** The execution simulation's `Dispatch` phase (`10-capacity-modeling-and-integration.md` §3.1/§3.6) — the assigned vehicle begins transit. `current_stage` stays `EXECUTE`. */
  async recordDispatched(orderId: string): Promise<Order> {
    return this.appendExecutionEvent(orderId, "ORDER_DISPATCHED");
  }

  /** The `Arrive` phase — vehicle reached the job location. `current_stage` stays `EXECUTE`. */
  async recordArrived(orderId: string): Promise<Order> {
    return this.appendExecutionEvent(orderId, "ORDER_ARRIVED");
  }

  /** Fired immediately after `recordArrived`, same Lambda call — on-site work begins (§3.1's "processing" is its own visible state). `current_stage` stays `EXECUTE`. */
  async recordProcessing(orderId: string): Promise<Order> {
    return this.appendExecutionEvent(orderId, "ORDER_PROCESSING");
  }

  /**
   * An execution failed (v1-prod-deployment.md Q3/F6): appends
   * `STAGE_FAILED` (stage `EXECUTE`) and sends the Order back to
   * `SCHEDULE` for the scheduler's normal path. `retry_counts.EXECUTE`
   * increments; the original `sla_deadline` is kept, so a retry sorts ahead
   * of newer work. The assignment, window, and materials estimate are
   * cleared; re-scheduling re-estimates them.
   */
  async recordExecutionFailed(orderId: string, operatorId: string, reason: string): Promise<Order> {
    /* Back in gsi1-stage-sla under SCHEDULE at its original deadline; gsi2 drops with the cleared assignment. */
    return this.appendToExistingOrder(orderId, "STAGE_FAILED", "EXECUTE", { operator_id: operatorId, reason }, (base) => ({
      current_stage: "SCHEDULE",
      retry_counts: { ...base.retry_counts, EXECUTE: (base.retry_counts.EXECUTE ?? 0) + 1 },
      scheduled_start: null,
      scheduled_end: null,
      assigned_operator_id: null,
      estimated_materials_cost: null,
      cost_model_used: null,
    }));
  }

  /**
   * The `Process/Resolve` phase's terminal step — on-site work finished,
   * moving `current_stage` from `EXECUTE` to `RESOLVE`. `actualMaterialsCost`
   * is null for an execution dispatched before materials cost existed.
   */
  async recordResolved(orderId: string, actualMaterialsCost: number | null): Promise<Order> {
    return this.appendToExistingOrder(
      orderId,
      "ORDER_RESOLVED",
      "EXECUTE",
      { materials_cost_actual: actualMaterialsCost },
      () => ({ current_stage: "RESOLVE", actual_materials_cost: actualMaterialsCost })
    );
  }

  /** Shared shape for the `EXECUTE`-stage narrative events that don't change `current_stage` or carry a payload (§3.1's `Dispatch`/`Arrive`/`Process` steps). */
  private async appendExecutionEvent(orderId: string, eventType: "ORDER_DISPATCHED" | "ORDER_ARRIVED" | "ORDER_PROCESSING"): Promise<Order> {
    return this.appendToExistingOrder(orderId, eventType, "EXECUTE", {}, () => ({}));
  }

  /**
   * The only path to `appendEvent`: builds the `SYSTEM` event envelope and
   * always stamps {@link orderIndexAttributes}, so no write method can skip
   * the GSI keys.
   */
  private async appendOrderEvent(
    orderId: string,
    eventType: OrderEventType,
    stage: OrderStage | null,
    payload: Record<string, unknown>,
    foldProjection: (previous: Order | null, event: OrderEvent) => Order
  ): Promise<Order> {
    const now = new Date().toISOString();
    return this.appendEvent(
      orderId,
      (nextSequence) => ({
        order_id: orderId,
        sequence_number: nextSequence,
        event_type: eventType,
        stage,
        payload,
        occurred_at: now,
        actor: "SYSTEM",
      }),
      foldProjection,
      orderIndexAttributes
    );
  }

  /**
   * {@link appendOrderEvent} for every event after `ORDER_CREATED`: requires
   * an existing projection, applies `changes`, and stamps `updated_at` /
   * `last_event_sequence` from the event.
   */
  private async appendToExistingOrder(
    orderId: string,
    eventType: OrderEventType,
    stage: OrderStage | null,
    payload: Record<string, unknown>,
    changes: (base: Order) => Partial<Order>
  ): Promise<Order> {
    return this.appendOrderEvent(orderId, eventType, stage, payload, (previous, event) => {
      const base = this.requirePreviousProjection(orderId, previous);
      return { ...base, ...changes(base), updated_at: event.occurred_at, last_event_sequence: event.sequence_number };
    });
  }

  /**
   * The scheduling job's priority queue (`6-order-scheduling.md` §2): a
   * `Query` on `gsi1-stage-sla` for `gsi1pk = "STAGE#SCHEDULE"`, ascending
   * by `sla_deadline` (`ScanIndexForward: true`) — oldest-deadline-first,
   * the exact ordering `ddb-design.md` built this index for. Cheaper than
   * `listOrders`' `Scan`-with-filter, and actually sorted.
   */
  async listOrdersWaitingForSchedule(options: ListOrdersWaitingForScheduleOptions): Promise<OrderListResult> {
    logInfo("OrderDao.listOrdersWaitingForSchedule", { table: this.tableName, options });

    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: STAGE_SLA_INDEX,
        KeyConditionExpression: "gsi1pk = :stagePk",
        ExpressionAttributeValues: { ":stagePk": stageSlaPartitionKey("SCHEDULE") },
        ScanIndexForward: true,
        Limit: options.limit,
        ExclusiveStartKey: options.cursor ? decodeCursor(options.cursor) : undefined,
      })
    );

    const orders = (result.Items ?? []).map((item) => this.validateOrderItem(item));
    const nextCursor = result.LastEvaluatedKey ? encodeCursor(result.LastEvaluatedKey) : null;
    return { orders, nextCursor };
  }

  /**
   * The fleet map's fading path trail plus its on-click current-order
   * detail (`11-street-condition-implementation.md` §7): one `Query` on
   * `gsi2-assigned-operator`, newest `updated_at` first, over-fetched to
   * `RECENT_JOBS_OVER_FETCH_LIMIT`. `currentOrder` is the newest
   * still-`EXECUTE` Order; `recentCompletedOrders` is the first
   * `RECENT_JOBS_LIMIT` at `RESOLVE`. One query serves both.
   */
  async getOperatorOrderActivity(operatorId: string): Promise<OperatorOrderActivity> {
    logInfo("OrderDao.getOperatorOrderActivity", { table: this.tableName, operatorId });
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: ASSIGNED_OPERATOR_INDEX,
        KeyConditionExpression: "gsi2pk = :operatorId",
        ExpressionAttributeValues: { ":operatorId": operatorId },
        ScanIndexForward: false,
        Limit: RECENT_JOBS_OVER_FETCH_LIMIT,
      })
    );
    const orders = (result.Items ?? []).map((item) => this.validateOrderItem(item));
    return {
      currentOrder: orders.find((order) => order.current_stage === "EXECUTE") ?? null,
      recentCompletedOrders: orders.filter((order) => order.current_stage === "RESOLVE").slice(0, RECENT_JOBS_LIMIT),
    };
  }

  /**
   * Every `OrderEvent` appended to one Order, in no guaranteed order — a
   * strongly consistent `Query` on its partition's `EVENT#` items, so a
   * consumer reacting to a just-appended event sees that event too.
   */
  async listOrderEvents(orderId: string): Promise<OrderEvent[]> {
    logInfo("OrderDao.listOrderEvents", { table: this.tableName, orderId });
    const events: OrderEvent[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const result = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: "order_id = :orderId AND begins_with(sk, :eventPrefix)",
          ExpressionAttributeValues: { ":orderId": orderId, ":eventPrefix": "EVENT#" },
          ConsistentRead: true,
          ExclusiveStartKey: exclusiveStartKey,
        })
      );
      for (const item of result.Items ?? []) {
        const parsed = OrderEventSchema.safeParse(item);
        if (!parsed.success) {
          throw new ValidationError(`Failed to validate an OrderEvent item for table ${this.tableName}`, parsed.error.issues);
        }
        events.push(parsed.data);
      }
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);
    return events;
  }

  private requirePreviousProjection(orderId: string, previous: Order | null): Order {
    if (!previous) {
      throw new ValidationError(
        `Cannot record an evaluation outcome for order ${orderId} — no OrderCreated projection exists yet`
      );
    }
    return previous;
  }

  private validateOrderItem(item: unknown): Order {
    const parsed = OrderSchema.safeParse(item);
    if (!parsed.success) {
      throw new ValidationError(`Failed to validate an Order item for table ${this.tableName}`, parsed.error.issues);
    }
    return parsed.data;
  }
}
