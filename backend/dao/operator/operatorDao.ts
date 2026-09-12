import { ulid } from "ulid";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { EventSourcedDao } from "../dao";
import { logInfo } from "../../logger";
import type { Operator, OperatorEvent } from "../../models/operator";
import { OperatorSchema, OperatorEventSchema } from "../../models/operator";
import { ValidationError } from "../../models/errors";

const ROSTER_INDEX = "gsi2-roster";
const ROSTER_PARTITION_KEY = "OPERATOR";

/**
 * Sparse — only set while `status = ACTIVE`, `current_activity = IDLE`,
 * and `removal_requested_at` is null (`10-capacity-modeling-and-integration.md`
 * §1.4). Not queried by this leg's CRUD/views — reserved for the real
 * `CapacityAvailabilityProvider` once capacity is wired into scheduling
 * (Leg 1.5, deliberately not yet).
 */
function projectionAttributes(operator: Operator): Record<string, unknown> {
  const attrs: Record<string, unknown> = {
    gsi2pk: ROSTER_PARTITION_KEY,
    gsi2sk: `${operator.status}#${operator.start_datetime}`,
  };
  if (operator.status === "ACTIVE" && operator.current_activity === "IDLE" && !operator.removal_requested_at) {
    attrs.gsi1pk = "AVAILABLE";
    attrs.gsi1sk = operator.start_datetime;
  }
  return attrs;
}

/**
 * Backs `Operator`/`OperatorEvent` (`data-model.md#operator`, simplified
 * for v1 per `10-capacity-modeling-and-integration.md` §1.1) — event-sourced,
 * same source-of-truth/projection split as `Order`.
 */
export class OperatorDao extends EventSourcedDao<Operator, OperatorEvent> {
  constructor(client: DynamoDBDocumentClient, tableName: string) {
    super(client, tableName, OperatorSchema, OperatorEventSchema, "operator_id");
  }

  /** Fleet entry — always a new `operator_id`, never reactivates a retired one (§1.1). */
  async addOperator(ratePerHour: number): Promise<Operator> {
    const operatorId = ulid();
    const now = new Date().toISOString();

    return this.appendEvent(
      operatorId,
      (nextSequence) => ({
        operator_id: operatorId,
        sequence_number: nextSequence,
        event_type: "OPERATOR_ADDED",
        payload: { rate_per_hour: ratePerHour },
        occurred_at: now,
        actor: "ADMIN",
      }),
      (_previous, event) => ({
        operator_id: operatorId,
        status: "ACTIVE",
        current_activity: "IDLE",
        removal_requested_at: null,
        start_datetime: now,
        end_datetime: null,
        rate_per_hour: ratePerHour,
        last_event_sequence: event.sequence_number,
      }),
      projectionAttributes
    );
  }

  /** Direct lookup by `operator_id`. */
  async getOperator(operatorId: string): Promise<Operator | null> {
    return this.getProjection(operatorId);
  }

  /**
   * Queues removal for a *busy* Operator — `current_activity` stays
   * whatever it was; finalized once its current execution resolves
   * (Leg 3, not yet built). No other projection field changes.
   */
  async queueRemoval(operatorId: string): Promise<Operator> {
    const now = new Date().toISOString();

    return this.appendEvent(
      operatorId,
      (nextSequence) => ({
        operator_id: operatorId,
        sequence_number: nextSequence,
        event_type: "OPERATOR_REMOVAL_REQUESTED",
        payload: {},
        occurred_at: now,
        actor: "ADMIN",
      }),
      (previous, event) => {
        const base = this.requirePreviousProjection(operatorId, previous);
        return { ...base, removal_requested_at: now, last_event_sequence: event.sequence_number };
      },
      projectionAttributes
    );
  }

  /** Finalizes retirement — immediately for an already-idle Operator, or once a queued removal's execution resolves. */
  async finalizeRemoval(operatorId: string): Promise<Operator> {
    const now = new Date().toISOString();

    return this.appendEvent(
      operatorId,
      (nextSequence) => ({
        operator_id: operatorId,
        sequence_number: nextSequence,
        event_type: "OPERATOR_REMOVED",
        payload: {},
        occurred_at: now,
        actor: "ADMIN",
      }),
      (previous, event) => {
        const base = this.requirePreviousProjection(operatorId, previous);
        return { ...base, status: "INACTIVE", end_datetime: now, last_event_sequence: event.sequence_number };
      },
      projectionAttributes
    );
  }

  /** Live fleet roster (`GET /capacity`) — every `ACTIVE` Operator, oldest-first. */
  async listActiveRoster(): Promise<Operator[]> {
    logInfo("OperatorDao.listActiveRoster", { table: this.tableName });
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: ROSTER_INDEX,
        KeyConditionExpression: "gsi2pk = :pk AND begins_with(gsi2sk, :statusPrefix)",
        ExpressionAttributeValues: { ":pk": ROSTER_PARTITION_KEY, ":statusPrefix": "ACTIVE#" },
      })
    );
    return (result.Items ?? []).map((item) => this.validateRosterItem(item));
  }

  private requirePreviousProjection(operatorId: string, previous: Operator | null): Operator {
    if (!previous) {
      throw new ValidationError(`Cannot record an update for operator ${operatorId} — no OperatorAdded projection exists yet`);
    }
    return previous;
  }

  private validateRosterItem(item: unknown): Operator {
    const parsed = OperatorSchema.safeParse(item);
    if (!parsed.success) {
      throw new ValidationError(`Failed to validate roster item against schema for table ${this.tableName}`, parsed.error.issues);
    }
    return parsed.data;
  }
}
