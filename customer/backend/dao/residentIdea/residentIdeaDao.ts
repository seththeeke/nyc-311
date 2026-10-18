import { GetCommand, QueryCommand, TransactWriteCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { ZodType } from "zod";
import { logInfo } from "../../logger";
import { ValidationError } from "../../models/errors";
import { RESIDENT_CURRENT_SK } from "../../models/resident";
import {
  IDEA_FEED_PK,
  IDEA_SK_PREFIX,
  ResidentIdeaSchema,
  ResidentOrderThreadSchema,
  THREAD_SK_PREFIX,
  ideaSortKey,
  threadSortKey,
  type ResidentIdea,
  type ResidentOrderThread,
} from "../../models/residentIdea";
import { encodeCursor, type DynamoKey } from "../cursor";

export const IDEA_FEED_INDEX = "Feed";
/* Thread rows read per resident when choosing what is new to them; far above any real resident's history today. */
const MAX_THREADS = 500;

export interface IdeaPage {
  items: ResidentIdea[];
  lastKey: string | null;
}

/**
 * Backs `ResidentIdeas` (§2 customer side, decision 4): ideas under
 * `IDEA#<ulid>` and one thread row per resident per order under
 * `ORDER#<order_id>`, both partitioned by `persona_id`. Recording an idea
 * also bumps the resident's counters in `Residents`, in the same
 * transaction, so the two tables never disagree.
 */
export class ResidentIdeaDao {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly residentsTableName: string
  ) {}

  /** One resident's ideas, newest first. */
  async listForResident(personaId: string, limit: number, startKey: DynamoKey | undefined): Promise<IdeaPage> {
    logInfo("ResidentIdeaDao.listForResident", { table: this.tableName, personaId, limit, startKey });
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "persona_id = :persona AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: { ":persona": personaId, ":prefix": IDEA_SK_PREFIX },
        ScanIndexForward: false,
        Limit: limit,
        ExclusiveStartKey: startKey,
      })
    );
    return { items: (result.Items ?? []).map((item) => this.parse(ResidentIdeaSchema, item)), lastKey: encodeCursor(result.LastEvaluatedKey) };
  }

  /** Every resident's ideas, newest first, through the Feed index. */
  async listFeed(limit: number, startKey: DynamoKey | undefined): Promise<IdeaPage> {
    logInfo("ResidentIdeaDao.listFeed", { table: this.tableName, index: IDEA_FEED_INDEX, limit, startKey });
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: IDEA_FEED_INDEX,
        KeyConditionExpression: "feed_pk = :feed",
        ExpressionAttributeValues: { ":feed": IDEA_FEED_PK },
        ScanIndexForward: false,
        Limit: limit,
        ExclusiveStartKey: startKey,
      })
    );
    return { items: (result.Items ?? []).map((item) => this.parse(ResidentIdeaSchema, item)), lastKey: encodeCursor(result.LastEvaluatedKey) };
  }

  async getIdea(personaId: string, ideaId: string): Promise<ResidentIdea | null> {
    logInfo("ResidentIdeaDao.getIdea", { table: this.tableName, personaId, ideaId });
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: { persona_id: personaId, sk: ideaSortKey(ideaId) } }));
    return result.Item ? this.parse(ResidentIdeaSchema, result.Item) : null;
  }

  /** Every order this resident has had an idea about (A6). */
  async listThreads(personaId: string): Promise<ResidentOrderThread[]> {
    logInfo("ResidentIdeaDao.listThreads", { table: this.tableName, personaId });
    const threads: ResidentOrderThread[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const result = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: "persona_id = :persona AND begins_with(sk, :prefix)",
          ExpressionAttributeValues: { ":persona": personaId, ":prefix": THREAD_SK_PREFIX },
          ExclusiveStartKey: startKey,
        })
      );
      threads.push(...(result.Items ?? []).map((item) => this.parse(ResidentOrderThreadSchema, item)));
      startKey = result.LastEvaluatedKey;
    } while (startKey && threads.length < MAX_THREADS);
    return threads;
  }

  /**
   * Writes the idea, its order's thread row (if it has an order) and the
   * resident's counters in one transaction. The idea must be new, and the
   * resident must exist.
   */
  async recordIdea(idea: ResidentIdea): Promise<void> {
    logInfo("ResidentIdeaDao.recordIdea", { table: this.tableName, personaId: idea.persona_id, ideaId: idea.idea_id, orderId: idea.order_id });
    const validated = this.parse(ResidentIdeaSchema, idea);
    const at = validated.created_at;
    const thread = validated.order_id
      ? [
          {
            Update: {
              TableName: this.tableName,
              Key: { persona_id: validated.persona_id, sk: threadSortKey(validated.order_id) },
              UpdateExpression: "SET order_id = :order, first_idea_at = if_not_exists(first_idea_at, :at), last_idea_at = :at ADD idea_count :one",
              ExpressionAttributeValues: { ":order": validated.order_id, ":at": at, ":one": 1 },
            },
          },
        ]
      : [];
    await this.client.send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: this.tableName, Item: validated, ConditionExpression: "attribute_not_exists(sk)" } },
          ...thread,
          {
            Update: {
              TableName: this.residentsTableName,
              Key: { persona_id: validated.persona_id, sk: RESIDENT_CURRENT_SK },
              UpdateExpression: "SET last_idea_at = :at ADD idea_count :one",
              ConditionExpression: "attribute_exists(sk)",
              ExpressionAttributeValues: { ":at": at, ":one": 1 },
            },
          },
        ],
      })
    );
  }

  private parse<T>(schema: ZodType<T>, item: unknown): T {
    const parsed = schema.safeParse(item);
    if (!parsed.success) throw new ValidationError(`Failed to validate item against schema for table ${this.tableName}`, parsed.error.issues);
    return parsed.data;
  }
}
