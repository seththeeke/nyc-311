import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { Dao, type PutItemOptions } from "../../dao/dao";
import { TerminalError, ValidationError } from "../../models/errors";

const TestEntitySchema = z.object({ id: z.string().min(1), value: z.number() });
type TestEntity = z.infer<typeof TestEntitySchema>;

class TestDao extends Dao<TestEntity> {
  constructor(client: DynamoDBDocumentClient) {
    super(client, "TestTable", TestEntitySchema, "id");
  }
  async get(id: string): Promise<TestEntity | null> {
    return this.getItem(id);
  }
  async put(entity: TestEntity, options?: PutItemOptions): Promise<void> {
    return this.putItem(entity, options);
  }
}

const ddbMock = mockClient(DynamoDBDocumentClient);
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const dao = new TestDao(client);

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  ddbMock.reset();
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Dao.getItem (via TestDao.get)", () => {
  it("returns the validated entity when found", async () => {
    ddbMock.on(GetCommand).resolves({ Item: { id: "a", value: 1 } });
    await expect(dao.get("a")).resolves.toEqual({ id: "a", value: 1 });
    expect(ddbMock.commandCalls(GetCommand)[0].args[0].input).toMatchObject({
      TableName: "TestTable",
      Key: { id: "a" },
    });
  });

  it("logs the partition key input", async () => {
    ddbMock.on(GetCommand).resolves({ Item: { id: "a", value: 1 } });
    await dao.get("a");
    const logged = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(logged).toMatchObject({ table: "TestTable", partitionKeyValue: "a" });
  });

  it("returns null when not found", async () => {
    ddbMock.on(GetCommand).resolves({});
    await expect(dao.get("missing")).resolves.toBeNull();
  });

  it("throws ValidationError when the stored item doesn't match the schema", async () => {
    ddbMock.on(GetCommand).resolves({ Item: { id: "a" } });
    await expect(dao.get("a")).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("Dao.putItem (via TestDao.put)", () => {
  it("writes without a ConditionExpression when none is given", async () => {
    ddbMock.on(PutCommand).resolves({});
    await dao.put({ id: "a", value: 1 });
    const input = ddbMock.commandCalls(PutCommand)[0].args[0].input;
    expect(input).toEqual({ TableName: "TestTable", Item: { id: "a", value: 1 } });
  });

  it("logs the entity input", async () => {
    ddbMock.on(PutCommand).resolves({});
    await dao.put({ id: "a", value: 1 });
    const logged = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(logged).toMatchObject({ table: "TestTable", entity: { id: "a", value: 1 } });
  });

  it("writes with a ConditionExpression when given", async () => {
    ddbMock.on(PutCommand).resolves({});
    await dao.put({ id: "a", value: 1 }, { conditionExpression: "attribute_not_exists(id)" });
    const input = ddbMock.commandCalls(PutCommand)[0].args[0].input;
    expect(input).toMatchObject({ ConditionExpression: "attribute_not_exists(id)" });
  });

  it("merges additionalAttributes onto the written item without validating them", async () => {
    ddbMock.on(PutCommand).resolves({});
    await dao.put({ id: "a", value: 1 }, { additionalAttributes: { gsi1pk: "derived-key" } });
    const input = ddbMock.commandCalls(PutCommand)[0].args[0].input;
    expect(input).toEqual({
      TableName: "TestTable",
      Item: { id: "a", value: 1, gsi1pk: "derived-key" },
    });
  });

  it("would otherwise strip an unrecognized field if passed as part of the entity, not additionalAttributes", async () => {
    ddbMock.on(PutCommand).resolves({});
    // @ts-expect-error intentionally passing a field the schema doesn't recognize
    await dao.put({ id: "a", value: 1, gsi1pk: "should-be-stripped" });
    const input = ddbMock.commandCalls(PutCommand)[0].args[0].input;
    expect(input).toEqual({ TableName: "TestTable", Item: { id: "a", value: 1 } });
  });

  it("throws ValidationError before writing when the entity is invalid", async () => {
    ddbMock.on(PutCommand).resolves({});
    // @ts-expect-error intentionally invalid for the test
    await expect(dao.put({ id: "a", value: "not-a-number" })).rejects.toBeInstanceOf(ValidationError);
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
  });

  it("wraps ConditionalCheckFailedException as TerminalError", async () => {
    ddbMock
      .on(PutCommand)
      .rejects(new ConditionalCheckFailedException({ message: "check failed", $metadata: {} }));
    await expect(dao.put({ id: "a", value: 1 })).rejects.toBeInstanceOf(TerminalError);
  });

  it("rethrows any other error unchanged", async () => {
    const boom = new Error("network blip");
    ddbMock.on(PutCommand).rejects(boom);
    await expect(dao.put({ id: "a", value: 1 })).rejects.toBe(boom);
  });
});
