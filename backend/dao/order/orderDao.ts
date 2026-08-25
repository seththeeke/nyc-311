import { ulid } from "ulid";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { EventSourcedDao, PROJECTION_SORT_KEY } from "../dao";
import { logInfo } from "../../logger";
import type { Order, OrderEvent, OrderStage, OrderStatus } from "../../models/order";
import { OrderSchema, OrderEventSchema, ORDER_STAGES } from "../../models/order";
import type { OrderListResult } from "../../models/orderListQuery";
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

  private validateOrderItem(item: unknown): Order {
    const parsed = OrderSchema.safeParse(item);
    if (!parsed.success) {
      throw new ValidationError(`Failed to validate an Order item for table ${this.tableName}`, parsed.error.issues);
    }
    return parsed.data;
  }
}
