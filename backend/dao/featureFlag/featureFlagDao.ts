import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { Dao } from "../dao";
import { logInfo } from "../../logger";
import type { FeatureFlag } from "../../models/featureFlag";
import { FeatureFlagSchema } from "../../models/featureFlag";

/**
 * Backs `FeatureFlag` (`11-street-condition-implementation.md` §4) — a
 * plain record keyed by `flag_key`. Writes are condition-checked so a
 * create never clobbers an existing flag and an update never lands on a
 * stale version.
 */
export class FeatureFlagDao extends Dao<FeatureFlag> {
  constructor(client: DynamoDBDocumentClient, tableName: string) {
    super(client, tableName, FeatureFlagSchema, "flag_key");
  }

  async getFlag(flagKey: string): Promise<FeatureFlag | null> {
    return this.getItem(flagKey);
  }

  /** Full Scan — the table holds a handful of flags, not a hot or large dataset. */
  async listFlags(): Promise<FeatureFlag[]> {
    logInfo("FeatureFlagDao.listFlags", { table: this.tableName });
    const flags: FeatureFlag[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const result = await this.client.send(
        new ScanCommand({ TableName: this.tableName, ExclusiveStartKey: exclusiveStartKey })
      );
      for (const item of result.Items ?? []) flags.push(this.validate(item));
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);
    return flags;
  }

  /** @throws {@link TerminalError} if a flag with this key already exists. */
  async createFlag(flag: FeatureFlag): Promise<void> {
    await this.putItem(flag, { conditionExpression: "attribute_not_exists(flag_key)" });
  }

  /** @throws {@link TerminalError} if the stored flag is missing or its version isn't `expectedVersion`. */
  async replaceFlag(flag: FeatureFlag, expectedVersion: number): Promise<void> {
    await this.putItem(flag, {
      conditionExpression: "attribute_exists(flag_key) AND #version = :expectedVersion",
      conditionExpressionNames: { "#version": "version" },
      conditionExpressionValues: { ":expectedVersion": expectedVersion },
    });
  }

  /** @returns `false` if no flag existed at this key. */
  async deleteFlag(flagKey: string): Promise<boolean> {
    logInfo("FeatureFlagDao.deleteFlag", { table: this.tableName, flagKey });
    const result = await this.client.send(
      new DeleteCommand({ TableName: this.tableName, Key: { flag_key: flagKey }, ReturnValues: "ALL_OLD" })
    );
    return result.Attributes !== undefined;
  }
}
