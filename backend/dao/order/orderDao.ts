import { ulid } from "ulid";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { EventSourcedDao, PROJECTION_SORT_KEY } from "../dao";
import { logInfo } from "../../logger";
import type { Order, OrderEvent, OrderEventType, OrderStage, OrderStatus } from "../../models/order";
import { OrderSchema, OrderEventSchema, ORDER_STAGES } from "../../models/order";
import type { OrderListResult } from "../../models/orderListQuery";
import type { OrderEventListResult } from "../../models/orderEventListQuery";
import { ValidationError } from "../../models/errors";

export interface CreateOrderInput {
  request_id: string;
  location_id: string;
}

export interface ListOrdersOptions {
  limit: number;
  cursor?: string | null;
  stage?: OrderStage;
  status?: OrderStatus;
}

export interface AcceptOrderInput {
  priorityTier: string;
  slaDeadline: string;
}

export interface ListOrderEventsOptions {
  limit: number;
  cursor?: string | null;
  orderId?: string;
  eventType?: OrderEventType;
}

/* EVENT#<n> — the literal prefix EventSourcedDao.appendEvent's sk values always start with. */
const EVENT_SORT_KEY_PREFIX = "EVENT#";

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
        payload: { request_id: input.request_id, location_id: input.location_id },
        occurred_at: now,
        actor: "SYSTEM",
      }),
      (_previous, event) => ({
        order_id: orderId,
        request_id: input.request_id,
        location_id: input.location_id,
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
      }
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

  private requirePreviousProjection(orderId: string, previous: Order | null): Order {
    if (!previous) {
      throw new ValidationError(
        `Cannot record an evaluation outcome for order ${orderId} — no OrderCreated projection exists yet`
      );
    }
    return previous;
  }

  /**
   * Paginated Order listing (3-order-ingestion.md's Order list view) — a
   * plain Scan filtered to `sk = "#METADATA"` so EVENT# items never leak
   * into the results, optionally further filtered by `current_stage`/
   * `status`. DynamoDB applies `FilterExpression` after `Limit` caps items
   * examined, so a page can come back shorter than `limit` (even empty,
   * with a non-null `nextCursor`) — a known quirk, fine for this basic
   * monitoring view.
   */
  async listOrders(options: ListOrdersOptions): Promise<OrderListResult> {
    const filterParts = ["sk = :metadataSk"];
    const values: Record<string, unknown> = { ":metadataSk": PROJECTION_SORT_KEY };
    const names: Record<string, string> = {};

    if (options.stage) {
      filterParts.push("current_stage = :stage");
      values[":stage"] = options.stage;
    }
    if (options.status) {
      filterParts.push("#status = :status");
      names["#status"] = "status";
      values[":status"] = options.status;
    }

    logInfo("OrderDao.listOrders", { table: this.tableName, options });

    const result = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: filterParts.join(" AND "),
        ExpressionAttributeValues: values,
        ...(Object.keys(names).length > 0 ? { ExpressionAttributeNames: names } : {}),
        Limit: options.limit,
        ExclusiveStartKey: options.cursor ? decodeCursor(options.cursor) : undefined,
      })
    );

    const orders = (result.Items ?? []).map((item) => this.validateOrderItem(item));
    const nextCursor = result.LastEvaluatedKey ? encodeCursor(result.LastEvaluatedKey) : null;
    return { orders, nextCursor };
  }

  /**
   * Paginated `OrderEvent` listing (`5-order-evaluation.md`'s Order Events
   * view, same shape as `listOrders`). Given `orderId`, a cheap `Query` on
   * that partition (`sk` begins with `EVENT#`). Without one, a table-wide
   * `Scan` filtered the same way — same page-shorter-than-`limit` quirk as
   * `listOrders`. The Scan path sorts by `occurred_at` descending in
   * application code; the Query path relies on `sk` order instead.
   */
  async listOrderEvents(options: ListOrderEventsOptions): Promise<OrderEventListResult> {
    logInfo("OrderDao.listOrderEvents", { table: this.tableName, options });

    if (options.orderId) {
      const filterParts: string[] = [];
      const values: Record<string, unknown> = {
        ":orderId": options.orderId,
        ":eventPrefix": EVENT_SORT_KEY_PREFIX,
      };
      if (options.eventType) {
        filterParts.push("event_type = :eventType");
        values[":eventType"] = options.eventType;
      }

      const result = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: "order_id = :orderId AND begins_with(sk, :eventPrefix)",
          ...(filterParts.length > 0 ? { FilterExpression: filterParts.join(" AND ") } : {}),
          ExpressionAttributeValues: values,
          ScanIndexForward: false,
          Limit: options.limit,
          ExclusiveStartKey: options.cursor ? decodeCursor(options.cursor) : undefined,
        })
      );

      const events = (result.Items ?? []).map((item) => this.validateOrderEventItem(item));
      const nextCursor = result.LastEvaluatedKey ? encodeCursor(result.LastEvaluatedKey) : null;
      return { events, nextCursor };
    }

    const filterParts = ["begins_with(sk, :eventPrefix)"];
    const values: Record<string, unknown> = { ":eventPrefix": EVENT_SORT_KEY_PREFIX };
    if (options.eventType) {
      filterParts.push("event_type = :eventType");
      values[":eventType"] = options.eventType;
    }

    const result = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: filterParts.join(" AND "),
        ExpressionAttributeValues: values,
        Limit: options.limit,
        ExclusiveStartKey: options.cursor ? decodeCursor(options.cursor) : undefined,
      })
    );

    const events = (result.Items ?? [])
      .map((item) => this.validateOrderEventItem(item))
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
    const nextCursor = result.LastEvaluatedKey ? encodeCursor(result.LastEvaluatedKey) : null;
    return { events, nextCursor };
  }

  private validateOrderItem(item: unknown): Order {
    const parsed = OrderSchema.safeParse(item);
    if (!parsed.success) {
      throw new ValidationError(`Failed to validate an Order item for table ${this.tableName}`, parsed.error.issues);
    }
    return parsed.data;
  }

  private validateOrderEventItem(item: unknown): OrderEvent {
    const parsed = OrderEventSchema.safeParse(item);
    if (!parsed.success) {
      throw new ValidationError(
        `Failed to validate an OrderEvent item for table ${this.tableName}`,
        parsed.error.issues
      );
    }
    return parsed.data;
  }
}
