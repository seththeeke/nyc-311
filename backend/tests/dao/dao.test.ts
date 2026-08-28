import { ConditionalCheckFailedException, DynamoDBClient, TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { Dao, EventSourcedDao, type PutItemOptions } from "../../dao/dao";
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

const TestProjectionSchema = z.object({
  id: z.string().min(1),
  total: z.number(),
  last_event_sequence: z.number().int().nonnegative(),
});
type TestProjection = z.infer<typeof TestProjectionSchema>;

const TestEventSchema = z.object({
  id: z.string().min(1),
  sequence_number: z.number().int().nonnegative(),
  amount: z.number(),
});
type TestEvent = z.infer<typeof TestEventSchema>;

class TestEventSourcedDao extends EventSourcedDao<TestProjection, TestEvent> {
  constructor(client: DynamoDBDocumentClient) {
    super(client, "TestEventTable", TestProjectionSchema, TestEventSchema, "id");
  }
  async getCurrent(id: string): Promise<TestProjection | null> {
    return this.getProjection(id);
  }
  async addAmount(id: string, amount: number): Promise<TestProjection> {
    return this.appendEvent(
      id,
      (nextSequence) => ({ id, sequence_number: nextSequence, amount }),
      (previous, event) => ({
        id,
        total: (previous?.total ?? 0) + event.amount,
        last_event_sequence: event.sequence_number,
      })
    );
  }
  async addAmountWithGsi(id: string, amount: number): Promise<TestProjection> {
    return this.appendEvent(
      id,
      (nextSequence) => ({ id, sequence_number: nextSequence, amount }),
      (previous, event) => ({
        id,
        total: (previous?.total ?? 0) + event.amount,
        last_event_sequence: event.sequence_number,
      }),
      (projection) => ({ gsi1pk: "TOTAL", gsi1sk: String(projection.total) })
    );
  }
  async addInvalidEvent(id: string): Promise<TestProjection> {
    return this.appendEvent(
      id,
      // @ts-expect-error intentionally invalid for the test
      () => ({ id, amount: "not-a-number" }),
      (previous, event) => ({
        id,
        total: (previous?.total ?? 0) + event.amount,
        last_event_sequence: event.sequence_number,
      })
    );
  }
  async addInvalidProjection(id: string): Promise<TestProjection> {
    return this.appendEvent(
      id,
      (nextSequence) => ({ id, sequence_number: nextSequence, amount: 1 }),
      // @ts-expect-error intentionally invalid for the test
      () => ({ id, total: "not-a-number" })
    );
  }
}

const ddbMock = mockClient(DynamoDBDocumentClient);
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const dao = new TestDao(client);
const eventSourcedDao = new TestEventSourcedDao(client);

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

  it("passes conditionExpressionValues as ExpressionAttributeValues", async () => {
    ddbMock.on(PutCommand).resolves({});
    await dao.put(
      { id: "a", value: 1 },
      { conditionExpression: "value = :expected", conditionExpressionValues: { ":expected": 0 } }
    );
    const input = ddbMock.commandCalls(PutCommand)[0].args[0].input;
    expect(input).toMatchObject({
      ConditionExpression: "value = :expected",
      ExpressionAttributeValues: { ":expected": 0 },
    });
  });
});

describe("EventSourcedDao.getProjection (via TestEventSourcedDao.getCurrent)", () => {
  it("fetches the #METADATA item and validates it", async () => {
    ddbMock.on(GetCommand).resolves({ Item: { id: "a", total: 5, last_event_sequence: 0 } });
    await expect(eventSourcedDao.getCurrent("a")).resolves.toEqual({ id: "a", total: 5, last_event_sequence: 0 });
    expect(ddbMock.commandCalls(GetCommand)[0].args[0].input).toMatchObject({
      TableName: "TestEventTable",
      Key: { id: "a", sk: "#METADATA" },
    });
  });

  it("returns null when no events exist yet", async () => {
    ddbMock.on(GetCommand).resolves({});
    await expect(eventSourcedDao.getCurrent("a")).resolves.toBeNull();
  });
});

describe("EventSourcedDao.appendEvent (via TestEventSourcedDao.addAmount)", () => {
  it("appends the first event at sequence 0 with no prior-projection condition", async () => {
    ddbMock.on(GetCommand).resolves({});
    ddbMock.on(TransactWriteCommand).resolves({});

    const result = await eventSourcedDao.addAmount("a", 10);

    expect(result).toEqual({ id: "a", total: 10, last_event_sequence: 0 });
    const transactInput = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input;
    expect(transactInput.TransactItems).toEqual([
      {
        Put: {
          TableName: "TestEventTable",
          Item: { id: "a", sk: "EVENT#0", sequence_number: 0, amount: 10 },
          ConditionExpression: "attribute_not_exists(sk)",
        },
      },
      {
        Put: {
          TableName: "TestEventTable",
          Item: { id: "a", sk: "#METADATA", total: 10, last_event_sequence: 0 },
          ConditionExpression: "attribute_not_exists(sk)",
        },
      },
    ]);
  });

  it("appends a subsequent event, folding onto the previous projection, condition-checked on last_event_sequence", async () => {
    ddbMock.on(GetCommand).resolves({ Item: { id: "a", total: 10, last_event_sequence: 0 } });
    ddbMock.on(TransactWriteCommand).resolves({});

    const result = await eventSourcedDao.addAmount("a", 5);

    expect(result).toEqual({ id: "a", total: 15, last_event_sequence: 1 });
    const transactInput = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input;
    expect(transactInput.TransactItems?.[0]).toMatchObject({
      Put: { Item: { sk: "EVENT#1", sequence_number: 1 } },
    });
    expect(transactInput.TransactItems?.[1]).toMatchObject({
      Put: {
        Item: { sk: "#METADATA", total: 15, last_event_sequence: 1 },
        ConditionExpression: "last_event_sequence = :previousSequence",
        ExpressionAttributeValues: { ":previousSequence": 0 },
      },
    });
  });

  it("wraps TransactionCanceledException as TerminalError", async () => {
    ddbMock.on(GetCommand).resolves({});
    ddbMock
      .on(TransactWriteCommand)
      .rejects(new TransactionCanceledException({ message: "cancelled", $metadata: {} }));

    await expect(eventSourcedDao.addAmount("a", 10)).rejects.toBeInstanceOf(TerminalError);
  });

  it("rethrows any other error unchanged", async () => {
    ddbMock.on(GetCommand).resolves({});
    const boom = new Error("network blip");
    ddbMock.on(TransactWriteCommand).rejects(boom);

    await expect(eventSourcedDao.addAmount("a", 10)).rejects.toBe(boom);
  });

  it("throws ValidationError before writing if the built event doesn't match its schema", async () => {
    ddbMock.on(GetCommand).resolves({});
    await expect(eventSourcedDao.addInvalidEvent("a")).rejects.toBeInstanceOf(ValidationError);
    expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(0);
  });

  it("throws ValidationError before writing if the folded projection doesn't match its schema", async () => {
    ddbMock.on(GetCommand).resolves({});
    await expect(eventSourcedDao.addInvalidProjection("a")).rejects.toBeInstanceOf(ValidationError);
    expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(0);
  });

  it("logs the append input", async () => {
    ddbMock.on(GetCommand).resolves({});
    ddbMock.on(TransactWriteCommand).resolves({});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await eventSourcedDao.addAmount("a", 10);

    const logged = JSON.parse(logSpy.mock.calls.at(-1)?.[0] as string);
    expect(logged).toMatchObject({ table: "TestEventTable", partitionKeyValue: "a", nextSequence: 0 });
  });

  it("merges additionalProjectionAttributes onto the projection Put item only, never the event item", async () => {
    ddbMock.on(GetCommand).resolves({});
    ddbMock.on(TransactWriteCommand).resolves({});

    await eventSourcedDao.addAmountWithGsi("a", 10);

    const transactInput = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input;
    expect(transactInput.TransactItems?.[0]).toMatchObject({
      Put: { Item: { id: "a", sk: "EVENT#0", amount: 10 } },
    });
    expect(transactInput.TransactItems?.[0]?.Put?.Item).not.toHaveProperty("gsi1pk");
    expect(transactInput.TransactItems?.[1]).toMatchObject({
      Put: { Item: { id: "a", sk: "#METADATA", total: 10, gsi1pk: "TOTAL", gsi1sk: "10" } },
    });
  });

  it("omits additionalProjectionAttributes entirely when no 4th argument is given (existing callers unaffected)", async () => {
    ddbMock.on(GetCommand).resolves({});
    ddbMock.on(TransactWriteCommand).resolves({});

    await eventSourcedDao.addAmount("a", 10);

    const transactInput = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input;
    expect(transactInput.TransactItems?.[1]?.Put?.Item).not.toHaveProperty("gsi1pk");
  });
});
