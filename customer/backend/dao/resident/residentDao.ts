import { GetCommand, QueryCommand, TransactWriteCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { ZodType } from "zod";
import { logInfo } from "../../logger";
import { ValidationError } from "../../models/errors";
import {
  RESIDENT_CURRENT_SK,
  RESIDENT_ROSTER_PK,
  ResidentContentSchema,
  ResidentCurrentSchema,
  ResidentCurrentVersionSchema,
  ResidentVersionSchema,
  type ResidentContent,
  type ResidentCurrent,
  type ResidentCurrentVersion,
  type ResidentVersion,
} from "../../models/resident";
import { encodeCursor, type DynamoKey } from "../cursor";

export const RESIDENT_ROSTER_INDEX = "Roster";

export interface ResidentPage {
  items: ResidentCurrent[];
  lastKey: string | null;
}

/**
 * Backs `Residents` (§2 customer side, decision 1): partition `persona_id`,
 * sort `sk` — `CURRENT` plus an immutable `V#nnnn` per version. A new
 * version and the matching `CURRENT` write always go in one transaction.
 */
export class ResidentDao {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string
  ) {}

  async getCurrent(personaId: string): Promise<ResidentCurrent | null> {
    logInfo("ResidentDao.getCurrent", { table: this.tableName, personaId });
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: { persona_id: personaId, sk: RESIDENT_CURRENT_SK } }));
    return result.Item ? this.parse(ResidentCurrentSchema, result.Item) : null;
  }

  /**
   * Only the version and content hash of a resident's CURRENT row, for the
   * seed sync. Never the whole row: a row written under an older content
   * shape must not stop the sync that rewrites it to the new one.
   */
  async getCurrentVersion(personaId: string): Promise<ResidentCurrentVersion | null> {
    logInfo("ResidentDao.getCurrentVersion", { table: this.tableName, personaId });
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { persona_id: personaId, sk: RESIDENT_CURRENT_SK },
        ProjectionExpression: "version, content_hash",
        ConsistentRead: true,
      })
    );
    return result.Item ? this.parse(ResidentCurrentVersionSchema, result.Item) : null;
  }

  /** Every resident's CURRENT row, by name of id, through the sparse Roster index. */
  async listCurrent(limit: number, startKey: DynamoKey | undefined): Promise<ResidentPage> {
    logInfo("ResidentDao.listCurrent", { table: this.tableName, index: RESIDENT_ROSTER_INDEX, limit, startKey });
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: RESIDENT_ROSTER_INDEX,
        KeyConditionExpression: "roster_pk = :roster",
        ExpressionAttributeValues: { ":roster": RESIDENT_ROSTER_PK },
        Limit: limit,
        ExclusiveStartKey: startKey,
      })
    );
    return {
      items: (result.Items ?? []).map((item) => this.parse(ResidentCurrentSchema, item)),
      lastKey: encodeCursor(result.LastEvaluatedKey),
    };
  }

  /** First sync of a resident: its `V#0001` row and a CURRENT row with zeroed counters. Fails if either exists. */
  async createResident(version: ResidentVersion, current: ResidentCurrent): Promise<void> {
    logInfo("ResidentDao.createResident", { table: this.tableName, personaId: current.persona_id, version: current.version });
    await this.client.send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: this.tableName, Item: this.parse(ResidentVersionSchema, version), ConditionExpression: "attribute_not_exists(sk)" } },
          { Put: { TableName: this.tableName, Item: this.parse(ResidentCurrentSchema, current), ConditionExpression: "attribute_not_exists(sk)" } },
        ],
      })
    );
  }

  /**
   * A changed seed: writes the new version row and sets CURRENT's content
   * fields, leaving its counters alone (an idea may be incrementing them).
   * Conditioned on CURRENT still being at `version - 1`, so two concurrent
   * syncs cannot both win.
   */
  async addVersion(version: ResidentVersion, content: ResidentContent, updatedAt: string): Promise<void> {
    logInfo("ResidentDao.addVersion", { table: this.tableName, personaId: content.persona_id, version: version.version });
    const fields = { ...this.parse(ResidentContentSchema, content), version: version.version, updated_at: updatedAt };
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = { ":previous": version.version - 1 };
    const sets = Object.entries(fields)
      .filter(([name]) => name !== "persona_id")
      .map(([name, value], i) => {
        names[`#f${i}`] = name;
        values[`:f${i}`] = value;
        return `#f${i} = :f${i}`;
      });
    names["#version"] = "version";
    await this.client.send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: this.tableName, Item: this.parse(ResidentVersionSchema, version), ConditionExpression: "attribute_not_exists(sk)" } },
          {
            Update: {
              TableName: this.tableName,
              Key: { persona_id: content.persona_id, sk: RESIDENT_CURRENT_SK },
              UpdateExpression: `SET ${sets.join(", ")}`,
              ConditionExpression: "#version = :previous",
              ExpressionAttributeNames: names,
              ExpressionAttributeValues: values,
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
