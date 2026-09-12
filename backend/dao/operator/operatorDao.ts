import { ulid } from "ulid";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { EventSourcedDao } from "../dao";
import { logInfo } from "../../logger";
import type { Operator, OperatorEvent } from "../../models/operator";
import { OperatorSchema, OperatorEventSchema } from "../../models/operator";
import type { GpsLocation } from "../../models/gpsLocation";
import { HOME_DEPOT_LOCATION } from "../../models/gpsLocation";
import { ValidationError } from "../../models/errors";

const ROSTER_INDEX = "gsi2-roster";
const ROSTER_PARTITION_KEY = "OPERATOR";
const AVAILABILITY_INDEX = "gsi1-availability";
const AVAILABILITY_PARTITION_KEY = "AVAILABLE";

/**
 * Sparse — only set while `status = ACTIVE`, `current_activity = IDLE`,
 * and `removal_requested_at` is null (`10-capacity-modeling-and-integration.md`
 * §1.4) — the real capacity-claim queue, `gsi1pk = "AVAILABLE"`, queried by
 * `findIdleOperator` (§3.5/§3.6).
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
  async addOperator(name: string, ratePerHour: number): Promise<Operator> {
    const operatorId = ulid();
    const now = new Date().toISOString();

    return this.appendEvent(
      operatorId,
      (nextSequence) => ({
        operator_id: operatorId,
        sequence_number: nextSequence,
        event_type: "OPERATOR_ADDED",
        payload: { name, rate_per_hour: ratePerHour, location: HOME_DEPOT_LOCATION },
        occurred_at: now,
        actor: "ADMIN",
      }),
      (_previous, event) => ({
        operator_id: operatorId,
        name,
        status: "ACTIVE",
        current_activity: "IDLE",
        removal_requested_at: null,
        start_datetime: now,
        end_datetime: null,
        rate_per_hour: ratePerHour,
        current_location: HOME_DEPOT_LOCATION,
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

  /**
   * The real capacity claim (`10-capacity-modeling-and-integration.md`
   * §3.5) — the oldest-tenured idle Operator, or `null` if the fleet is
   * fully busy. Read-only; pair with {@link startTransit} to actually
   * claim it. Atomic claim across concurrent invocations is explicitly
   * deferred (§1.5) — the scheduling job's own single-threaded loop is
   * the only writer of idle→busy transitions today.
   */
  async findIdleOperator(): Promise<Operator | null> {
    logInfo("OperatorDao.findIdleOperator", { table: this.tableName });
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: AVAILABILITY_INDEX,
        KeyConditionExpression: "gsi1pk = :pk",
        ExpressionAttributeValues: { ":pk": AVAILABILITY_PARTITION_KEY },
        ScanIndexForward: true,
        Limit: 1,
      })
    );
    const item = (result.Items ?? [])[0];
    return item ? this.validateRosterItem(item) : null;
  }

  /**
   * Claims an idle Operator for dispatch (§3.5/§3.6) — the scheduling
   * job's own idle→busy transition, performed synchronously at
   * assignment time (before the execution state machine even starts),
   * not deferred to the state machine's `Dispatch` Task. Fires
   * `TRANSIT_STARTED`; the GPS ping carries wherever the Operator's last
   * recorded position was (§3.7) — unchanged by this transition, only the
   * activity is.
   */
  async startTransit(operatorId: string): Promise<Operator> {
    const now = new Date().toISOString();
    const previous = this.requirePreviousProjection(operatorId, await this.getProjection(operatorId));

    return this.appendEvent(
      operatorId,
      (nextSequence) => ({
        operator_id: operatorId,
        sequence_number: nextSequence,
        event_type: "TRANSIT_STARTED",
        payload: { location: previous.current_location },
        occurred_at: now,
        actor: "SYSTEM",
      }),
      (existing, event) => {
        const base = this.requirePreviousProjection(operatorId, existing);
        return { ...base, current_activity: "TRANSIT", last_event_sequence: event.sequence_number };
      },
      projectionAttributes
    );
  }

  /** Vehicle reached the job location (§3.2's `Arrive` phase). Fires `WORK_STARTED`, stamping the arrival GPS ping. */
  async startWork(operatorId: string, location: GpsLocation): Promise<Operator> {
    const now = new Date().toISOString();

    return this.appendEvent(
      operatorId,
      (nextSequence) => ({
        operator_id: operatorId,
        sequence_number: nextSequence,
        event_type: "WORK_STARTED",
        payload: { location },
        occurred_at: now,
        actor: "SYSTEM",
      }),
      (previous, event) => {
        const base = this.requirePreviousProjection(operatorId, previous);
        return { ...base, current_activity: "WORKING", current_location: location, last_event_sequence: event.sequence_number };
      },
      projectionAttributes
    );
  }

  /**
   * On-site work finished (§3.2's `Process/Resolve` phase). Fires
   * `WORK_COMPLETED`, returning to `IDLE` — back in the availability
   * queue unless a removal is already queued (the caller finalizes that
   * separately via {@link finalizeRemoval}, same two-step precedent as
   * everywhere else removal is queued). No return-to-depot leg is
   * modeled (§3.7) — the GPS ping stays at wherever `WORK_STARTED` left it.
   */
  async completeWork(operatorId: string): Promise<Operator> {
    const now = new Date().toISOString();
    const previous = this.requirePreviousProjection(operatorId, await this.getProjection(operatorId));

    return this.appendEvent(
      operatorId,
      (nextSequence) => ({
        operator_id: operatorId,
        sequence_number: nextSequence,
        event_type: "WORK_COMPLETED",
        payload: { location: previous.current_location },
        occurred_at: now,
        actor: "SYSTEM",
      }),
      (existing, event) => {
        const base = this.requirePreviousProjection(operatorId, existing);
        return { ...base, current_activity: "IDLE", last_event_sequence: event.sequence_number };
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
