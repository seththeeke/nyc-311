import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, ScanCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderDao } from "../../../dao/order/orderDao";
import { ValidationError } from "../../../models/errors";

const TABLE_NAME = "Orders";
const ddbMock = mockClient(DynamoDBDocumentClient);
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const orderDao = new OrderDao(client, TABLE_NAME);

function makeOrderItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    order_id: "01ORDER",
    sk: "#METADATA",
    request_id: "01REQUEST",
    location_id: "1234567890",
    current_stage: "INGEST",
    status: "CREATED",
    retry_counts: { INGEST: 0, SCHEDULE: 0, EXECUTE: 0, RESOLVE: 0 },
    priority_tier: null,
    sla_deadline: null,
    scheduled_start: null,
    scheduled_end: null,
    assigned_operator_id: null,
    reassignment_count: 0,
    case_id: null,
    created_at: "2026-08-20T00:00:00.000Z",
    updated_at: "2026-08-20T00:00:00.000Z",
    last_event_sequence: 0,
    ...overrides,
  };
}

beforeEach(() => {
  ddbMock.reset();
  ddbMock.on(GetCommand).resolves({});
  ddbMock.on(TransactWriteCommand).resolves({});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OrderDao.createOrder", () => {
  it("creates an Order in its first state: INGEST stage, CREATED status, zeroed retry counts", async () => {
    const order = await orderDao.createOrder({ request_id: "01REQUEST", location_id: "1234567890" });

    expect(order).toMatchObject({
      request_id: "01REQUEST",
      location_id: "1234567890",
      current_stage: "INGEST",
      status: "CREATED",
      retry_counts: { INGEST: 0, SCHEDULE: 0, EXECUTE: 0, RESOLVE: 0 },
      priority_tier: null,
      sla_deadline: null,
      scheduled_start: null,
      scheduled_end: null,
      assigned_operator_id: null,
      reassignment_count: 0,
      case_id: null,
      last_event_sequence: 0,
    });
    expect(order.order_id).toBeTruthy();
  });

  it("writes an ORDER_CREATED event with the request/location in its payload", async () => {
    await orderDao.createOrder({ request_id: "01REQUEST", location_id: "1234567890" });

    const transactInput = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input;
    const eventPut = transactInput.TransactItems?.[0]?.Put;
    expect(eventPut?.Item).toMatchObject({
      sk: "EVENT#0",
      event_type: "ORDER_CREATED",
      stage: null,
      actor: "SYSTEM",
      payload: { request_id: "01REQUEST", location_id: "1234567890" },
    });
  });

  it("generates a distinct order_id per call", async () => {
    const first = await orderDao.createOrder({ request_id: "01REQUEST", location_id: "1234567890" });
    const second = await orderDao.createOrder({ request_id: "02REQUEST", location_id: "1234567890" });

    expect(first.order_id).not.toBe(second.order_id);
  });
});

describe("OrderDao.listOrders", () => {
  it("scans with a projection-only filter and returns validated orders, no cursor when unpaginated", async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [makeOrderItem()] });

    const result = await orderDao.listOrders({ limit: 20 });

    const expectedOrder: Record<string, unknown> = makeOrderItem();
    delete expectedOrder["sk"];
    expect(result.orders).toEqual([expectedOrder]);
    expect(result.nextCursor).toBeNull();
    const input = ddbMock.commandCalls(ScanCommand)[0].args[0].input;
    expect(input.FilterExpression).toBe("sk = :metadataSk");
    expect(input.ExpressionAttributeValues).toEqual({ ":metadataSk": "#METADATA" });
    expect(input.Limit).toBe(20);
    expect(input.ExclusiveStartKey).toBeUndefined();
  });

  it("adds a current_stage filter when stage is given", async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [] });

    await orderDao.listOrders({ limit: 20, stage: "INGEST" });

    const input = ddbMock.commandCalls(ScanCommand)[0].args[0].input;
    expect(input.FilterExpression).toBe("sk = :metadataSk AND current_stage = :stage");
    expect(input.ExpressionAttributeValues).toMatchObject({ ":stage": "INGEST" });
  });

  it("adds a status filter (via an expression attribute name, status is reserved) when status is given", async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [] });

    await orderDao.listOrders({ limit: 20, status: "CREATED" });

    const input = ddbMock.commandCalls(ScanCommand)[0].args[0].input;
    expect(input.FilterExpression).toBe("sk = :metadataSk AND #status = :status");
    expect(input.ExpressionAttributeNames).toEqual({ "#status": "status" });
    expect(input.ExpressionAttributeValues).toMatchObject({ ":status": "CREATED" });
  });

  it("decodes an incoming cursor into ExclusiveStartKey and encodes LastEvaluatedKey as the next cursor", async () => {
    const lastKey = { order_id: "01ORDER", sk: "#METADATA" };
    ddbMock.on(ScanCommand).resolves({ Items: [], LastEvaluatedKey: lastKey });
    const incomingCursor = Buffer.from(JSON.stringify({ order_id: "00PREV", sk: "#METADATA" })).toString("base64url");

    const result = await orderDao.listOrders({ limit: 20, cursor: incomingCursor });

    const input = ddbMock.commandCalls(ScanCommand)[0].args[0].input;
    expect(input.ExclusiveStartKey).toEqual({ order_id: "00PREV", sk: "#METADATA" });
    expect(result.nextCursor).not.toBeNull();
    expect(JSON.parse(Buffer.from(result.nextCursor as string, "base64url").toString("utf8"))).toEqual(lastKey);
  });

  it("throws ValidationError for a malformed cursor", async () => {
    const notJsonCursor = Buffer.from("not valid json", "utf8").toString("base64url");

    await expect(orderDao.listOrders({ limit: 20, cursor: notJsonCursor })).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError when a scanned item fails OrderSchema validation", async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [{ order_id: "01ORDER" }] });

    await expect(orderDao.listOrders({ limit: 20 })).rejects.toThrow(ValidationError);
  });

  it("treats a response with no Items as an empty page", async () => {
    ddbMock.on(ScanCommand).resolves({});

    const result = await orderDao.listOrders({ limit: 20 });

    expect(result.orders).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });
});
