import { ulid } from "ulid";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { EventSourcedDao } from "../dao";
import { logInfo } from "../../logger";
import type { Order, OrderEvent, OrderStage } from "../../models/order";
import { OrderSchema, OrderEventSchema, ORDER_STAGES } from "../../models/order";
import type { OrderListResult } from "../../models/orderListResult";
import { ValidationError } from "../../models/errors";

export interface CreateOrderInput {
  request_id: string;
  location_id: string;
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
 * Every `additionalProjectionAttributes` Put fully replaces the item, so
 * gsi2pk/gsi2sk must be re-stamped on every write from scheduleOrder
 * onward, not just scheduleOrder's own — otherwise the very next
 * execution event (dispatched/arrived/processing/resolved) silently
 * drops them, since none of those touch gsi2 on their own.
 */
function assignedOperatorAttributes(projection: Order): Record<string, unknown> {
  if (!projection.assigned_operator_id) return {};
  return { gsi2pk: projection.assigned_operator_id, gsi2sk: projection.updated_at };
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
    const now = new Date().toISOString();

    return this.appendEvent(
      orderId,
      (nextSequence) => ({
        order_id: orderId,
        sequence_number: nextSequence,
        event_type: "ORDER_CREATED",
        stage: null,
        payload: {
          request_id: input.request_id,
          location_id: input.location_id,
          complaint_type: input.complaint_type,
        },
        occurred_at: now,
        actor: "SYSTEM",
      }),
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
        created_at: now,
        updated_at: now,
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
    const now = new Date().toISOString();
    return this.appendEvent(
      orderId,
      (nextSequence) => ({
        order_id: orderId,
        sequence_number: nextSequence,
        event_type: "ORDER_ACCEPTED",
        stage: null,
        payload: { priority_tier: input.priorityTier, sla_deadline: input.slaDeadline },
        occurred_at: now,
        actor: "SYSTEM",
      }),
      (previous, event) => {
        const base = this.requirePreviousProjection(orderId, previous);
        return {
          ...base,
          current_stage: "SCHEDULE",
          status: "ACTIVE",
          priority_tier: input.priorityTier,
          sla_deadline: input.slaDeadline,
          updated_at: now,
          last_event_sequence: event.sequence_number,
        };
      },
      /*
       * First point sla_deadline becomes non-null, so the first point this
       * item can appear in gsi1-stage-sla at all — DynamoDB requires both
       * halves of a sparse GSI's key present (6-order-scheduling.md §2).
       */
      (projection) => ({ gsi1pk: stageSlaPartitionKey(projection.current_stage), gsi1sk: projection.sla_deadline })
    );
  }

  /**
   * Records an evaluation `REJECT` outcome (`5-order-evaluation.md` §1/§4):
   * appends `ORDER_REJECTED`, terminal — `status: "REJECTED"`,
   * `current_stage` stays wherever it already was (never advanced).
   */
  async rejectOrder(orderId: string, reason: string): Promise<Order> {
    const now = new Date().toISOString();
    return this.appendEvent(
      orderId,
      (nextSequence) => ({
        order_id: orderId,
        sequence_number: nextSequence,
        event_type: "ORDER_REJECTED",
        stage: null,
        payload: { reason },
        occurred_at: now,
        actor: "SYSTEM",
      }),
      (previous, event) => {
        const base = this.requirePreviousProjection(orderId, previous);
        return { ...base, status: "REJECTED", updated_at: now, last_event_sequence: event.sequence_number };
      }
    );
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
    const now = new Date().toISOString();
    return this.appendEvent(
      orderId,
      (nextSequence) => ({
        order_id: orderId,
        sequence_number: nextSequence,
        event_type: "CASE_CREATED",
        stage: null,
        payload: { reason },
        occurred_at: now,
        actor: "SYSTEM",
      }),
      (previous, event) => {
        const base = this.requirePreviousProjection(orderId, previous);
        return { ...base, updated_at: now, last_event_sequence: event.sequence_number };
      }
    );
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
    const now = new Date().toISOString();
    return this.appendEvent(
      orderId,
      (nextSequence) => ({
        order_id: orderId,
        sequence_number: nextSequence,
        event_type: "ORDER_SCHEDULED",
        stage: "SCHEDULE",
        payload: {
          scheduled_start: input.scheduledStart,
          scheduled_end: input.scheduledEnd,
          operator_id: input.operatorId,
        },
        occurred_at: now,
        actor: "SYSTEM",
      }),
      (previous, event) => {
        const base = this.requirePreviousProjection(orderId, previous);
        return {
          ...base,
          current_stage: "EXECUTE",
          scheduled_start: input.scheduledStart,
          scheduled_end: input.scheduledEnd,
          assigned_operator_id: input.operatorId,
          updated_at: now,
          last_event_sequence: event.sequence_number,
        };
      },
      /*
       * Keeps the item in gsi1-stage-sla under its new stage — same index
       * also answers "how many Orders in stage X" (ddb-design.md). Also
       * (11-street-condition-implementation.md §7) stamps gsi2-assigned-
       * operator, first set here since this is where assigned_operator_id
       * first becomes non-null.
       */
      (projection) => ({
        gsi1pk: stageSlaPartitionKey(projection.current_stage),
        gsi1sk: projection.sla_deadline,
        ...assignedOperatorAttributes(projection),
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

  /** The `Process/Resolve` phase's terminal step — on-site work finished, moving `current_stage` from `EXECUTE` to `RESOLVE`. */
  async recordResolved(orderId: string): Promise<Order> {
    const now = new Date().toISOString();
    return this.appendEvent(
      orderId,
      (nextSequence) => ({
        order_id: orderId,
        sequence_number: nextSequence,
        event_type: "ORDER_RESOLVED",
        stage: "EXECUTE",
        payload: {},
        occurred_at: now,
        actor: "SYSTEM",
      }),
      (previous, event) => {
        const base = this.requirePreviousProjection(orderId, previous);
        return { ...base, current_stage: "RESOLVE", updated_at: now, last_event_sequence: event.sequence_number };
      },
      (projection) => ({
        gsi1pk: stageSlaPartitionKey(projection.current_stage),
        gsi1sk: projection.sla_deadline,
        ...assignedOperatorAttributes(projection),
      })
    );
  }

  /** Shared shape for the `EXECUTE`-stage narrative events that don't change `current_stage` or carry a payload (§3.1's `Dispatch`/`Arrive`/`Process` steps). */
  private async appendExecutionEvent(orderId: string, eventType: "ORDER_DISPATCHED" | "ORDER_ARRIVED" | "ORDER_PROCESSING"): Promise<Order> {
    const now = new Date().toISOString();
    return this.appendEvent(
      orderId,
      (nextSequence) => ({
        order_id: orderId,
        sequence_number: nextSequence,
        event_type: eventType,
        stage: "EXECUTE",
        payload: {},
        occurred_at: now,
        actor: "SYSTEM",
      }),
      (previous, event) => {
        const base = this.requirePreviousProjection(orderId, previous);
        return { ...base, updated_at: now, last_event_sequence: event.sequence_number };
      },
      (projection) => ({
        gsi1pk: stageSlaPartitionKey(projection.current_stage),
        gsi1sk: projection.sla_deadline,
        ...assignedOperatorAttributes(projection),
      })
    );
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
