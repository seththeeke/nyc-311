import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { QueryCommand, TransactWriteCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { z, ZodTypeAny } from "zod";
import { logInfo } from "../../logger";
import { TerminalError, ValidationError } from "../../models/errors";
import { RESIDENT_CURRENT_SK } from "../../models/resident";
import {
  IDEA_FEED_PK,
  IdeaStepSchema,
  ResidentIdeaSchema,
  ResidentOrderThreadSchema,
  THREAD_SK_PREFIX,
  ideaSortKey,
  threadSortKey,
  type IdeaResolution,
  type IdeaStep,
  type ResidentIdea,
  type ResidentOrderThread,
} from "../../models/residentIdea";
import { encodeCursor, type DynamoKey } from "../cursor";

export const IDEA_FEED_INDEX = "Feed";
/* Idea rows only, so a resident's ideas list without their step rows (docs/16 §5.3). */
export const IDEA_BY_RESIDENT_INDEX = "ByResident";
/* Thread rows read per resident when choosing what is new to them; far above any real resident's history today. */
const MAX_THREADS = 500;

export interface IdeaPage {
  items: ResidentIdea[];
  lastKey: string | null;
}

export interface IdeaWithSteps {
  idea: ResidentIdea;
  /* In order, oldest first. */
  steps: IdeaStep[];
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

  /** One resident's ideas, newest first, through the ByResident index (A3). */
  async listForResident(personaId: string, limit: number, startKey: DynamoKey | undefined): Promise<IdeaPage> {
    logInfo("ResidentIdeaDao.listForResident", { table: this.tableName, index: IDEA_BY_RESIDENT_INDEX, personaId, limit, startKey });
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: IDEA_BY_RESIDENT_INDEX,
        KeyConditionExpression: "resident_pk = :persona",
        ExpressionAttributeValues: { ":persona": personaId },
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

  /**
   * One idea and its whole workstream in a single query (R1): the idea row
   * sorts first, its `#STEP#` rows after it in order. Strongly consistent,
   * since the action worker resumes from it.
   */
  async getIdeaWithSteps(personaId: string, ideaId: string): Promise<IdeaWithSteps | null> {
    logInfo("ResidentIdeaDao.getIdeaWithSteps", { table: this.tableName, personaId, ideaId });
    const ideaKey = ideaSortKey(ideaId);
    const items: Record<string, unknown>[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const result = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: "persona_id = :persona AND begins_with(sk, :idea)",
          ExpressionAttributeValues: { ":persona": personaId, ":idea": ideaKey },
          ConsistentRead: true,
          ExclusiveStartKey: startKey,
        })
      );
      items.push(...(result.Items ?? []));
      startKey = result.LastEvaluatedKey;
    } while (startKey);
    const [first, ...rest] = items;
    if (!first || first.sk !== ideaKey) return null;
    return { idea: this.parse(ResidentIdeaSchema, first), steps: rest.map((item) => this.parse(IdeaStepSchema, item)) };
  }

  /**
   * Appends one workstream step and sets the idea's resolution to match,
   * in one transaction (docs/16 §5.3). The step must be new and the idea's
   * `last_step_sequence` must be the step's predecessor, so a redelivered
   * message can never write a step twice or out of order.
   *
   * @throws {@link TerminalError} when the step already exists or the idea moved on.
   */
  async appendStep(step: IdeaStep, resolution: IdeaResolution): Promise<void> {
    const validated = this.parse(IdeaStepSchema, step);
    logInfo("ResidentIdeaDao.appendStep", {
      table: this.tableName,
      personaId: validated.persona_id,
      ideaId: validated.idea_id,
      sequence: validated.sequence,
      kind: validated.kind,
      resolutionStatus: resolution.status,
    });
    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            { Put: { TableName: this.tableName, Item: validated, ConditionExpression: "attribute_not_exists(sk)" } },
            {
              Update: {
                TableName: this.tableName,
                Key: { persona_id: validated.persona_id, sk: ideaSortKey(validated.idea_id) },
                UpdateExpression: "SET resolution = :resolution",
                ConditionExpression:
                  "attribute_exists(sk) AND (attribute_not_exists(resolution) OR resolution.last_step_sequence = :previous)",
                ExpressionAttributeValues: { ":resolution": resolution, ":previous": validated.sequence - 1 },
              },
            },
          ],
        })
      );
    } catch (err) {
      if (err instanceof TransactionCanceledException) {
        throw new TerminalError(`Step ${validated.sequence} of idea ${validated.idea_id} conflicts with what is stored`, err);
      }
      throw err;
    }
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

  private parse<S extends ZodTypeAny>(schema: S, item: unknown): z.output<S> {
    const parsed = schema.safeParse(item);
    if (!parsed.success) throw new ValidationError(`Failed to validate item against schema for table ${this.tableName}`, parsed.error.issues);
    return parsed.data;
  }
}
