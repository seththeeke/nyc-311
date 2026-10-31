import { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResidentDao } from "../../../dao/resident/residentDao";
import { ValidationError } from "../../../models/errors";
import { versionSortKey } from "../../../models/resident";
import { buildResidentContent } from "../../../service/resident/residentSyncService";
import { current, seed } from "../../residentFixtures";

const ddbMock = mockClient(DynamoDBDocumentClient);
const dao = new ResidentDao(ddbMock as unknown as DynamoDBDocumentClient, "Residents-Prod");
const content = buildResidentContent(seed);
const versionRow = { ...content, sk: versionSortKey(4), version: 4, created_at: "2026-10-17T00:00:00.000Z" };

beforeEach(() => {
  ddbMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("ResidentDao", () => {
  it("reads only the version and hash for the sync, even from a row stored before the action loop (deploy regression, 2026-10-31)", async () => {
    const preActionLoop: Record<string, unknown> = { ...current, action_weights: { REQUEST_FEATURE: 0, CHECK_STATUS_API: 0, BROWSE_WEBSITE: 0 }, action_buckets: [] };
    delete preActionLoop.action_prompt;
    delete preActionLoop.action_prompt_version;
    ddbMock.on(GetCommand).resolvesOnce({ Item: { version: current.version, content_hash: current.content_hash } }).resolvesOnce({ Item: preActionLoop }).resolvesOnce({});
    await expect(dao.getCurrentVersion("hawthorn")).resolves.toEqual({ version: current.version, content_hash: current.content_hash });
    expect(ddbMock.commandCalls(GetCommand)[0].args[0].input).toMatchObject({ ProjectionExpression: "version, content_hash", ConsistentRead: true });
    await expect(dao.getCurrentVersion("hawthorn")).resolves.toEqual({ version: current.version, content_hash: current.content_hash });
    await expect(dao.getCurrentVersion("nobody")).resolves.toBeNull();
  });

  it("gets a CURRENT row, or null", async () => {
    ddbMock.on(GetCommand).resolvesOnce({ Item: current }).resolvesOnce({});
    await expect(dao.getCurrent("hawthorn")).resolves.toEqual(current);
    await expect(dao.getCurrent("nobody")).resolves.toBeNull();
    expect(ddbMock.commandCalls(GetCommand)[0].args[0].input.Key).toEqual({ persona_id: "hawthorn", sk: "CURRENT" });
  });

  it("rejects a stored row that does not match the schema", async () => {
    ddbMock.on(GetCommand).resolves({ Item: { persona_id: "hawthorn", sk: "CURRENT" } });
    await expect(dao.getCurrent("hawthorn")).rejects.toThrow(ValidationError);
  });

  it("lists the roster through its index with a cursor for the next page", async () => {
    ddbMock.on(QueryCommand).resolvesOnce({ Items: [current], LastEvaluatedKey: { persona_id: "hawthorn", sk: "CURRENT", roster_pk: "ALL" } }).resolvesOnce({});
    const first = await dao.listCurrent(1, undefined);
    expect(first.items).toEqual([current]);
    expect(first.lastKey).not.toBeNull();
    await expect(dao.listCurrent(1, { persona_id: "hawthorn" })).resolves.toEqual({ items: [], lastKey: null });
    expect(ddbMock.commandCalls(QueryCommand)[0].args[0].input).toMatchObject({ IndexName: "Roster", Limit: 1 });
  });

  it("creates a resident as one transaction, neither row existing", async () => {
    ddbMock.on(TransactWriteCommand).resolves({});
    await dao.createResident({ ...versionRow, sk: "V#0001", version: 1 }, { ...current, version: 1 });
    const items = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems ?? [];
    expect(items.map((item) => item.Put?.ConditionExpression)).toEqual(["attribute_not_exists(sk)", "attribute_not_exists(sk)"]);
  });

  it("adds a version and sets only CURRENT's content, conditioned on the previous version", async () => {
    ddbMock.on(TransactWriteCommand).resolves({});
    await dao.addVersion(versionRow, content, "2026-10-17T00:00:00.000Z");
    const [put, update] = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems ?? [];
    expect(put.Put?.Item).toMatchObject({ sk: "V#0004", version: 4 });
    expect(update.Update?.Key).toEqual({ persona_id: "hawthorn", sk: "CURRENT" });
    expect(update.Update?.ExpressionAttributeValues?.[":previous"]).toBe(3);
    expect(Object.values(update.Update?.ExpressionAttributeNames ?? {})).not.toContain("idea_count");
    expect(Object.values(update.Update?.ExpressionAttributeNames ?? {})).toContain("updated_at");
  });
});
