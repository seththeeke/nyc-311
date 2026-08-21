import { ulid } from "ulid";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { EventSourcedDao } from "../dao";
import type { Order, OrderEvent } from "../../models/order";
import { OrderSchema, OrderEventSchema, ORDER_STAGES } from "../../models/order";

export interface CreateOrderInput {
  request_id: string;
  location_id: string;
}

export class OrderDao extends EventSourcedDao<Order, OrderEvent> {
  constructor(client: DynamoDBDocumentClient, tableName: string) {
    super(client, tableName, OrderSchema, OrderEventSchema, "order_id");
  }

  /**
   * Creates a new Order in its first state (`3-order-ingestion.md` §5) —
   * `current_stage: "INGEST"`, everything workflow-derived (priority,
   * schedule, assignment) still null/zero until `4-order-workflow.md`'s
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
}
