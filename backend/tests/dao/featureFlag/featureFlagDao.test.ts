import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureFlagDao } from "../../../dao/featureFlag/featureFlagDao";
import { TerminalError, ValidationError } from "../../../models/errors";
import type { FeatureFlag } from "../../../models/featureFlag";

const TABLE_NAME = "FeatureFlags";
const ddbMock = mockClient(DynamoDBDocumentClient);
const dao = new FeatureFlagDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), TABLE_NAME);

const flag: FeatureFlag = {
  flag_key: "COST_MODEL",
  description: "",
  treatments: ["BRUTE_FORCE", "ML"],
  default_treatment: "BRUTE_FORCE",
  overrides: [],
  allocations: [{ treatment: "ML", percent: 10 }],
  version: 2,
  created_at: "2026-09-27T00:00:00.000Z",
  updated_at: "2026-09-27T00:00:00.000Z",
  updated_by: "01ADMIN",
};

beforeEach(() => {
  ddbMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("FeatureFlagDao.getFlag", () => {
  it("returns the validated flag or null", async () => {
    ddbMock.on(GetCommand).resolvesOnce({ Item: flag }).resolvesOnce({});
    await expect(dao.getFlag("COST_MODEL")).resolves.toEqual(flag);
    await expect(dao.getFlag("MISSING")).resolves.toBeNull();
    expect(ddbMock.commandCalls(GetCommand)[0].args[0].input.Key).toEqual({ flag_key: "COST_MODEL" });
  });
});

describe("FeatureFlagDao.listFlags", () => {
  it("scans every page", async () => {
    const other = { ...flag, flag_key: "OTHER" };
    ddbMock
      .on(ScanCommand)
      .resolvesOnce({ Items: [flag], LastEvaluatedKey: { flag_key: "COST_MODEL" } })
      .resolvesOnce({ Items: [other] });
    await expect(dao.listFlags()).resolves.toEqual([flag, other]);
    expect(ddbMock.commandCalls(ScanCommand)[1].args[0].input.ExclusiveStartKey).toEqual({ flag_key: "COST_MODEL" });
  });

  it("handles an empty table", async () => {
    ddbMock.on(ScanCommand).resolves({});
    await expect(dao.listFlags()).resolves.toEqual([]);
  });

  it("fails loudly on a corrupt stored item", async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [{ flag_key: "BAD" }] });
    await expect(dao.listFlags()).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("FeatureFlagDao.createFlag", () => {
  it("puts with attribute_not_exists", async () => {
    ddbMock.on(PutCommand).resolves({});
    await dao.createFlag(flag);
    expect(ddbMock.commandCalls(PutCommand)[0].args[0].input.ConditionExpression).toBe("attribute_not_exists(flag_key)");
  });

  it("throws TerminalError when the key exists", async () => {
    ddbMock.on(PutCommand).rejects(new ConditionalCheckFailedException({ message: "exists", $metadata: {} }));
    await expect(dao.createFlag(flag)).rejects.toBeInstanceOf(TerminalError);
  });
});

describe("FeatureFlagDao.replaceFlag", () => {
  it("conditions on the expected version", async () => {
    ddbMock.on(PutCommand).resolves({});
    await dao.replaceFlag(flag, 1);
    const input = ddbMock.commandCalls(PutCommand)[0].args[0].input;
    expect(input.ConditionExpression).toBe("attribute_exists(flag_key) AND #version = :expectedVersion");
    expect(input.ExpressionAttributeNames).toEqual({ "#version": "version" });
    expect(input.ExpressionAttributeValues).toEqual({ ":expectedVersion": 1 });
  });
});

describe("FeatureFlagDao.deleteFlag", () => {
  it("returns true when an item was deleted, false otherwise", async () => {
    ddbMock.on(DeleteCommand).resolvesOnce({ Attributes: flag }).resolvesOnce({});
    await expect(dao.deleteFlag("COST_MODEL")).resolves.toBe(true);
    await expect(dao.deleteFlag("MISSING")).resolves.toBe(false);
    expect(ddbMock.commandCalls(DeleteCommand)[0].args[0].input).toEqual({
      TableName: TABLE_NAME,
      Key: { flag_key: "COST_MODEL" },
      ReturnValues: "ALL_OLD",
    });
  });
});
