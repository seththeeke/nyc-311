import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { type DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { ZodType } from "zod";
import { logInfo } from "../logger";
import { TerminalError, ValidationError } from "../models/errors";

/** Options for {@link Dao.putItem}. */
export interface PutItemOptions {
  /**
   * A DynamoDB `ConditionExpression`. Passing one turns a
   * `ConditionalCheckFailedException` into a thrown {@link TerminalError}
   * — never silently overwrite an item by accident.
   */
  conditionExpression?: string;
}

/**
 * Shared base for the customer's plain single-item entities: one
 * partition key, no sort key, every read and write parsed through a zod
 * schema. A trimmed copy of `backend/dao/dao.ts`'s `Dao`, never imported
 * (CLAUDE.md §5.4).
 *
 * @typeParam TEntity - The domain type this DAO reads and writes.
 */
export abstract class Dao<TEntity> {
  constructor(
    protected readonly client: DynamoDBDocumentClient,
    protected readonly tableName: string,
    protected readonly schema: ZodType<TEntity>,
    protected readonly partitionKeyName: string
  ) {}

  /**
   * Fetches one item by partition key, validated against `schema`.
   *
   * @returns The entity, or `null` if no item exists at that key.
   * @throws {@link ValidationError} if the stored item doesn't match `schema`.
   */
  protected async getItem(partitionKeyValue: string): Promise<TEntity | null> {
    logInfo("Dao.getItem", { table: this.tableName, partitionKeyValue });
    const result = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { [this.partitionKeyName]: partitionKeyValue } })
    );
    if (!result.Item) return null;
    return this.validate(result.Item);
  }

  /**
   * Validates `entity`, then writes it whole (no partial updates).
   *
   * @throws {@link ValidationError} if `entity` doesn't match `schema` — before any DynamoDB call.
   * @throws {@link TerminalError} if `options.conditionExpression` was given and the condition failed.
   */
  protected async putItem(entity: TEntity, options: PutItemOptions = {}): Promise<void> {
    logInfo("Dao.putItem", { table: this.tableName, entity, conditionExpression: options.conditionExpression });
    const validated = this.validate(entity);
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: validated as Record<string, unknown>,
          ...(options.conditionExpression ? { ConditionExpression: options.conditionExpression } : {}),
        })
      );
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) {
        throw new TerminalError(`Conditional check failed while writing to ${this.tableName}`, err);
      }
      throw err;
    }
  }

  /** @throws {@link ValidationError} if `item` doesn't match `schema`. */
  protected validate(item: unknown): TEntity {
    const parsed = this.schema.safeParse(item);
    if (!parsed.success) {
      throw new ValidationError(`Failed to validate item against schema for table ${this.tableName}`, parsed.error.issues);
    }
    return parsed.data;
  }
}
