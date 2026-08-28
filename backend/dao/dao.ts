import { ConditionalCheckFailedException, TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import type { ZodType } from "zod";
import { logInfo } from "../logger";
import { TerminalError, ValidationError } from "../models/errors";

/* Exported so DAOs needing a raw Scan/Query (e.g. OrderDao.listOrders) can filter to projection-only items. */
export const PROJECTION_SORT_KEY = "#METADATA";

/**
 * Options for {@link Dao.putItem}.
 */
export interface PutItemOptions {
  /**
   * A DynamoDB `ConditionExpression`, e.g. `"attribute_not_exists(request_id)"`.
   * Omit for a plain overwrite-capable put. Passing one turns a
   * {@link ConditionalCheckFailedException} from the write into a thrown
   * {@link TerminalError} — never silently overwrite an item by accident.
   */
  conditionExpression?: string;
  /**
   * Bound values for placeholders (`:name`) referenced in
   * `conditionExpression`, e.g. `{ ":expectedStatus": "DRAFT" }` for
   * `"status = :expectedStatus"`. Omit if the expression uses none
   * (`attribute_not_exists(...)` needs no bound value).
   */
  conditionExpressionValues?: Record<string, unknown>;
  /**
   * Extra attributes merged onto the item after validation — for
   * storage-only concerns (e.g. a table's GSI key attributes) that aren't
   * part of `TEntity`'s domain schema and would otherwise be stripped by
   * zod. Omit for entities with no GSIs.
   */
  additionalAttributes?: Record<string, unknown>;
}

/**
 * Shared base for the "plain" (non-event-sourced) entities per
 * `ddb-design.md` — Location, Request, Shift, User. Single item per entity,
 * one partition key, no sort key. Event-sourced entities (Order, Case,
 * Operator) need their own base class instead — built when one of those
 * DAOs is.
 *
 * @typeParam TEntity - The domain type this DAO reads and writes, as
 * inferred from `schema`.
 */
export abstract class Dao<TEntity> {
  /**
   * @param client - A `DynamoDBDocumentClient`, shared across DAOs in a
   * given Lambda invocation (construct once, reuse).
   * @param tableName - The physical DynamoDB table name, per `ddb-design.md`.
   * @param schema - The zod schema for `TEntity`. Every item read from or
   * written to this table is parsed through it — see {@link validate}.
   * @param partitionKeyName - The table's partition-key attribute name
   * (e.g. `"request_id"`), used to build the `Key` for {@link getItem}.
   */
  constructor(
    protected readonly client: DynamoDBDocumentClient,
    protected readonly tableName: string,
    protected readonly schema: ZodType<TEntity>,
    protected readonly partitionKeyName: string
  ) {}

  /**
   * Fetches a single item by its partition key and validates it against
   * `schema` before returning it. Logs its input (table + partition key
   * value) per CLAUDE.md §5.2's "dao layer logs the inputs" rule.
   *
   * @param partitionKeyValue - The value of {@link partitionKeyName} to look up.
   * @returns The validated entity, or `null` if no item exists at that key.
   * @throws {@link ValidationError} if the stored item doesn't match `schema`
   * — this indicates corrupted or out-of-band-written data, since every
   * write in this codebase goes through {@link putItem}'s own validation.
   */
  protected async getItem(partitionKeyValue: string): Promise<TEntity | null> {
    logInfo("Dao.getItem", { table: this.tableName, partitionKeyValue });
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { [this.partitionKeyName]: partitionKeyValue },
      })
    );
    if (!result.Item) return null;
    return this.validate(result.Item);
  }

  /**
   * Validates `entity` against `schema`, merges in any
   * `options.additionalAttributes`, then writes the result as-is (no
   * partial updates). Logs its input (table, entity, condition expression,
   * additional attributes) before validating, so a rejected write is still
   * visible in the logs with what was attempted.
   *
   * @param entity - The entity to write. Must already be fully formed;
   * this method does not merge with an existing item.
   * @param options - See {@link PutItemOptions}.
   * @throws {@link ValidationError} if `entity` doesn't match `schema` —
   * thrown before any DynamoDB call is made, so a bad write never reaches
   * the table.
   * @throws {@link TerminalError} if `options.conditionExpression` was given
   * and DynamoDB reports a {@link ConditionalCheckFailedException}.
   * @throws The original error, unwrapped, for any other DynamoDB failure
   * (throttling, network, ...) — this base class doesn't attempt to
   * reclassify every possible AWS SDK failure mode, only the one condition
   * this codebase actually branches on.
   */
  protected async putItem(entity: TEntity, options: PutItemOptions = {}): Promise<void> {
    logInfo("Dao.putItem", {
      table: this.tableName,
      entity,
      conditionExpression: options.conditionExpression,
      additionalAttributes: options.additionalAttributes,
    });
    const validated = this.validate(entity);
    const item = { ...validated, ...options.additionalAttributes } as Record<string, unknown>;
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ...(options.conditionExpression
            ? { ConditionExpression: options.conditionExpression }
            : {}),
          ...(options.conditionExpressionValues
            ? { ExpressionAttributeValues: options.conditionExpressionValues }
            : {}),
        })
      );
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) {
        throw new TerminalError(
          `Conditional check failed while writing to ${this.tableName}`,
          err
        );
      }
      throw err;
    }
  }

  /**
   * Parses an unknown value (a DynamoDB item, typically) against `schema`.
   * Exposed as `protected` rather than `private` so subclasses can validate
   * items fetched through their own queries (e.g. a GSI `Query`, which
   * doesn't go through {@link getItem}) using the same rules.
   *
   * @param item - The raw value to validate.
   * @returns The parsed, typed entity.
   * @throws {@link ValidationError} if `item` doesn't match `schema`.
   */
  protected validate(item: unknown): TEntity {
    const parsed = this.schema.safeParse(item);
    if (!parsed.success) {
      throw new ValidationError(
        `Failed to validate item against schema for table ${this.tableName}`,
        parsed.error.issues
      );
    }
    return parsed.data;
  }
}

/**
 * Shared base for the event-sourced entities per `ddb-design.md` — Order,
 * Case, Operator. A root `#METADATA` projection item plus
 * `EVENT#<sequence_number>` items in the same partition; {@link appendEvent}
 * writes both atomically, condition-checked against `last_event_sequence`
 * so a concurrent append can never silently clobber another.
 *
 * @typeParam TProjection - The current-state, read-optimized shape.
 * @typeParam TEvent - The append-only event shape.
 */
export abstract class EventSourcedDao<
  TProjection extends { last_event_sequence: number },
  TEvent extends { sequence_number: number },
> {
  /**
   * @param client - Shared `DynamoDBDocumentClient`.
   * @param tableName - The physical table name.
   * @param projectionSchema - Validates the `#METADATA` item.
   * @param eventSchema - Validates each `EVENT#<n>` item.
   * @param partitionKeyName - The table's partition-key attribute name.
   */
  constructor(
    protected readonly client: DynamoDBDocumentClient,
    protected readonly tableName: string,
    protected readonly projectionSchema: ZodType<TProjection>,
    protected readonly eventSchema: ZodType<TEvent>,
    protected readonly partitionKeyName: string
  ) {}

  /**
   * Fetches the current projection (the `#METADATA` item), or `null` if
   * this partition has no events yet.
   */
  protected async getProjection(partitionKeyValue: string): Promise<TProjection | null> {
    logInfo("EventSourcedDao.getProjection", { table: this.tableName, partitionKeyValue });
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { [this.partitionKeyName]: partitionKeyValue, sk: PROJECTION_SORT_KEY },
      })
    );
    if (!result.Item) return null;
    return this.validateProjection(result.Item);
  }

  /**
   * Appends one event and atomically updates the projection to match, per
   * this class's own doc comment. `buildEvent` receives the next
   * `sequence_number` (the current projection's plus one, or `0` for the
   * first event); `foldProjection` derives the new projection from the
   * previous one (`null` if this is the first event) and the new event.
   *
   * @param additionalProjectionAttributes - Optional, derives storage-only
   * attributes (e.g. a table's GSI key attributes) from the new projection,
   * merged onto the projection `Put` item only — never the event item, per
   * `ddb-design.md`'s "sparse — set only on projection items" rule. Keeps
   * `TProjection`'s schema the pure domain shape, same reasoning as
   * `Dao.putItem`'s `additionalAttributes`.
   *
   * @throws {@link TerminalError} if the transaction is cancelled — another
   * append won the race for this `sequence_number`.
   */
  protected async appendEvent(
    partitionKeyValue: string,
    buildEvent: (nextSequence: number) => TEvent,
    foldProjection: (previous: TProjection | null, event: TEvent) => TProjection,
    additionalProjectionAttributes?: (projection: TProjection) => Record<string, unknown>
  ): Promise<TProjection> {
    const previousProjection = await this.getProjection(partitionKeyValue);
    const nextSequence = previousProjection ? previousProjection.last_event_sequence + 1 : 0;
    const event = this.validateEvent(buildEvent(nextSequence));
    const newProjection = this.validateProjection(foldProjection(previousProjection, event));
    const extraAttributes = additionalProjectionAttributes ? additionalProjectionAttributes(newProjection) : {};

    logInfo("EventSourcedDao.appendEvent", {
      table: this.tableName,
      partitionKeyValue,
      nextSequence,
      event,
      extraAttributes,
    });

    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.tableName,
                Item: { [this.partitionKeyName]: partitionKeyValue, sk: `EVENT#${nextSequence}`, ...event },
                ConditionExpression: "attribute_not_exists(sk)",
              },
            },
            {
              Put: {
                TableName: this.tableName,
                Item: {
                  [this.partitionKeyName]: partitionKeyValue,
                  sk: PROJECTION_SORT_KEY,
                  ...newProjection,
                  ...extraAttributes,
                },
                ...(previousProjection
                  ? {
                      ConditionExpression: "last_event_sequence = :previousSequence",
                      ExpressionAttributeValues: { ":previousSequence": previousProjection.last_event_sequence },
                    }
                  : { ConditionExpression: "attribute_not_exists(sk)" }),
              },
            },
          ],
        })
      );
    } catch (err) {
      if (err instanceof TransactionCanceledException) {
        throw new TerminalError(
          `Event append transaction cancelled for ${this.tableName}/${partitionKeyValue}`,
          err
        );
      }
      throw err;
    }

    return newProjection;
  }

  private validateProjection(item: unknown): TProjection {
    const parsed = this.projectionSchema.safeParse(item);
    if (!parsed.success) {
      throw new ValidationError(
        `Failed to validate projection item against schema for table ${this.tableName}`,
        parsed.error.issues
      );
    }
    return parsed.data;
  }

  private validateEvent(item: unknown): TEvent {
    const parsed = this.eventSchema.safeParse(item);
    if (!parsed.success) {
      throw new ValidationError(
        `Failed to validate event item against schema for table ${this.tableName}`,
        parsed.error.issues
      );
    }
    return parsed.data;
  }
}
