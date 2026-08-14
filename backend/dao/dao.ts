import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { ZodType } from "zod";
import { logInfo } from "../logger";
import { TerminalError, ValidationError } from "../models/errors";

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
   * Extra attributes merged onto the item after validation — for
   * storage-layer-only concerns (e.g. a table's `gsiNpk`/`gsiNsk` GSI key
   * attributes, per `ddb-design.md`) that deliberately aren't part of
   * `TEntity`'s domain schema. They're merged in *after* {@link validate}
   * runs, not validated themselves — zod's default `z.object()` behavior
   * strips unrecognized keys, so passing them as part of `entity` would
   * silently vanish before the write. Omit for entities with no GSIs, or
   * whose GSI keys are already domain fields.
   */
  additionalAttributes?: Record<string, unknown>;
}

/**
 * Shared base for the "plain" (non-event-sourced) entities per
 * `ddb-design.md` — Location, Request, Shift, User. Each of those tables is
 * a single item per entity, keyed on one partition key with no sort key, so
 * this class only needs to know the schema and the partition-key attribute
 * name to provide validated get/put.
 *
 * Event-sourced entities (Order, Case, Operator) do not extend this — their
 * item-collection + `TransactWriteItems` pattern (root `#METADATA` item +
 * `EVENT#<n>` items in the same partition) is different enough to need its
 * own base class, built when one of those DAOs is.
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
