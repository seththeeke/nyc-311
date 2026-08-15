import { ulid } from "ulid";
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
import { POLLER_METRICS_GSI_PK, PollerMetricsSchema, type PollerMetrics } from "../../models/pollerMetrics";

const EXTERNAL_KEY_INDEX = "gsi1-external-key";
const POLLER_METRICS_INDEX = "gsi4-poller-metrics";

export class RequestDao extends Dao<Request> {
  constructor(client: DynamoDBDocumentClient, tableName: string) {
    super(client, tableName, RequestSchema, "request_id");
  }

  /** Never silently overwrites — request_id is a freshly-minted ULID per record. */
  async putRequest(request: Request): Promise<void> {
    await this.putItem(request, {
      conditionExpression: "attribute_not_exists(request_id)",
      additionalAttributes: this.gsiAttributesFor(request),
    });
  }

  /**
   * Derives the three GSI key attributes ddb-design.md's Requests table
   * defines (`gsi1-external-key`, `gsi2-status`, `gsi3-location`) from the
   * domain fields already on `request`. These are deliberately not part of
   * `RequestSchema` — merged in via `Dao.putItem`'s `additionalAttributes`
   * instead — so `Request` stays the pure domain shape everywhere it's
   * read back (`getRequestById`/`findByExternalUniqueKey` naturally strip
   * them back out via zod's default parsing).
   *
   * gsi3pk/gsi3sk are omitted (not set to null) while `location_id` is
   * null, per ddb-design.md's "sparse — null while status = DRAFT" note —
   * DynamoDB requires a GSI key attribute to be entirely absent from the
   * item for that item to stay out of the index, not merely null-valued.
   */
  private gsiAttributesFor(request: Request): Record<string, unknown> {
    return {
      gsi1pk: request.external_unique_key,
      gsi2pk: request.status,
      gsi2sk: request.created_at,
      ...(request.location_id !== null
        ? { gsi3pk: request.location_id, gsi3sk: request.created_at }
        : {}),
    };
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

  /**
   * Appends one poller run's outcome as a new item, per 1-data-ingestion.md
   * §8a. Never overwrites a prior run — each write gets a freshly-minted
   * `METRIC#<ulid>` base key, with `gsi4pk`/`gsi4sk` set so
   * {@link listPollerMetrics} can retrieve the full history in one Query.
   */
  async putPollerMetrics(metrics: PollerMetrics): Promise<void> {
    logInfo("RequestDao.putPollerMetrics", { table: this.tableName, metrics });
    const validated = this.validatePollerMetrics(metrics);
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          [this.partitionKeyName]: `METRIC#${ulid()}`,
          gsi4pk: POLLER_METRICS_GSI_PK,
          gsi4sk: validated.ran_at,
          ...validated,
        },
      })
    );
  }

  /** The NYC 311 poller's full run history, most recent first — backs the public ingestion-metrics API. */
  async listPollerMetrics(): Promise<PollerMetrics[]> {
    logInfo("RequestDao.listPollerMetrics", { table: this.tableName });
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: POLLER_METRICS_INDEX,
        KeyConditionExpression: "gsi4pk = :pk",
        ExpressionAttributeValues: { ":pk": POLLER_METRICS_GSI_PK },
        ScanIndexForward: false,
      })
    );
    return (result.Items ?? []).map((item) => this.validatePollerMetrics(item));
  }

  private validatePollerMetrics(item: unknown): PollerMetrics {
    const parsed = PollerMetricsSchema.safeParse(item);
    if (!parsed.success) {
      throw new ValidationError("Failed to validate a poller metrics item", parsed.error.issues);
    }
    return parsed.data;
  }
}
