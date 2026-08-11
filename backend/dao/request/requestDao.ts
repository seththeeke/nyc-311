import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { Dao } from "../dao";
import { logInfo } from "../../logger";
import type { Request } from "../../models/request";
import { RequestSchema } from "../../models/request";
import { ValidationError } from "../../models/errors";
import {
  CURSOR_SENTINEL_PK,
  IngestionCursorSchema,
  type IngestionCursor,
} from "../../models/ingestionCursor";

const EXTERNAL_KEY_INDEX = "gsi1-external-key";

export class RequestDao extends Dao<Request> {
  constructor(client: DynamoDBDocumentClient, tableName: string) {
    super(client, tableName, RequestSchema, "request_id");
  }

  /** Never silently overwrites — request_id is a freshly-minted ULID per record. */
  async putRequest(request: Request): Promise<void> {
    await this.putItem(request, { conditionExpression: "attribute_not_exists(request_id)" });
  }

  async getRequestById(requestId: string): Promise<Request | null> {
    return this.getItem(requestId);
  }

  /** The dedup check run on every ingested record, per ddb-design.md's Requests table GSI1. */
  async findByExternalUniqueKey(externalUniqueKey: string): Promise<Request | null> {
    logInfo("RequestDao.findByExternalUniqueKey", { table: this.tableName, externalUniqueKey });
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: EXTERNAL_KEY_INDEX,
        KeyConditionExpression: "gsi1pk = :externalUniqueKey",
        ExpressionAttributeValues: { ":externalUniqueKey": externalUniqueKey },
        Limit: 1,
      })
    );
    const item = result.Items?.[0];
    if (!item) return null;
    return this.validate(item);
  }

  /** Sentinel item in this same table, per ddb-design.md's Requests table design notes. */
  async getCursor(): Promise<IngestionCursor | null> {
    logInfo("RequestDao.getCursor", { table: this.tableName, sentinelKey: CURSOR_SENTINEL_PK });
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { [this.partitionKeyName]: CURSOR_SENTINEL_PK },
      })
    );
    if (!result.Item) return null;
    return this.validateCursor(result.Item);
  }

  async putCursor(cursor: IngestionCursor): Promise<void> {
    logInfo("RequestDao.putCursor", { table: this.tableName, cursor });
    const validated = this.validateCursor(cursor);
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { [this.partitionKeyName]: CURSOR_SENTINEL_PK, ...validated },
      })
    );
  }

  private validateCursor(item: unknown): IngestionCursor {
    const parsed = IngestionCursorSchema.safeParse(item);
    if (!parsed.success) {
      throw new ValidationError("Failed to validate the ingestion cursor item", parsed.error.issues);
    }
    return parsed.data;
  }
}
