import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
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

describe("OrderDao.getOrder", () => {
  it("returns the projection when it exists", async () => {
    ddbMock.on(GetCommand).resolves({ Item: makeOrderItem() });

    const order = await orderDao.getOrder("01ORDER");

    expect(order?.order_id).toBe("01ORDER");
  });

  it("returns null when no projection exists yet", async () => {
    ddbMock.on(GetCommand).resolves({});

    await expect(orderDao.getOrder("01ORDER")).resolves.toBeNull();
  });
});

describe("OrderDao.acceptOrder", () => {
  it("moves current_stage to SCHEDULE and status to ACTIVE, stamping priority/SLA", async () => {
    ddbMock.on(GetCommand).resolves({ Item: makeOrderItem() });

    const order = await orderDao.acceptOrder("01ORDER", { priorityTier: "STANDARD", slaDeadline: "2026-08-27T00:00:00.000Z" });

    expect(order).toMatchObject({
      current_stage: "SCHEDULE",
      status: "ACTIVE",
      priority_tier: "STANDARD",
      sla_deadline: "2026-08-27T00:00:00.000Z",
    });
  });

  it("writes an ORDER_ACCEPTED event", async () => {
    ddbMock.on(GetCommand).resolves({ Item: makeOrderItem() });

    await orderDao.acceptOrder("01ORDER", { priorityTier: "STANDARD", slaDeadline: "2026-08-27T00:00:00.000Z" });

    const transactInput = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input;
    expect(transactInput.TransactItems?.[0]?.Put?.Item).toMatchObject({ event_type: "ORDER_ACCEPTED" });
  });

  it("stamps gsi1pk/gsi1sk on the projection item, per 6-order-scheduling.md §2 — first point sla_deadline is non-null", async () => {
    ddbMock.on(GetCommand).resolves({ Item: makeOrderItem() });

    await orderDao.acceptOrder("01ORDER", { priorityTier: "STANDARD", slaDeadline: "2026-08-27T00:00:00.000Z" });

    const transactInput = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input;
    expect(transactInput.TransactItems?.[1]?.Put?.Item).toMatchObject({
      gsi1pk: "STAGE#SCHEDULE",
      gsi1sk: "2026-08-27T00:00:00.000Z",
    });
  });

  it("throws ValidationError when no projection exists yet", async () => {
    ddbMock.on(GetCommand).resolves({});

    await expect(
      orderDao.acceptOrder("01ORDER", { priorityTier: "STANDARD", slaDeadline: "2026-08-27T00:00:00.000Z" })
    ).rejects.toThrow(ValidationError);
  });
});

describe("OrderDao.rejectOrder", () => {
  it("sets status to REJECTED, leaving current_stage untouched", async () => {
    ddbMock.on(GetCommand).resolves({ Item: makeOrderItem() });

    const order = await orderDao.rejectOrder("01ORDER", "no good reason");

    expect(order).toMatchObject({ status: "REJECTED", current_stage: "INGEST" });
  });

  it("writes an ORDER_REJECTED event carrying the reason", async () => {
    ddbMock.on(GetCommand).resolves({ Item: makeOrderItem() });

    await orderDao.rejectOrder("01ORDER", "no good reason");

    const transactInput = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input;
    expect(transactInput.TransactItems?.[0]?.Put?.Item).toMatchObject({
      event_type: "ORDER_REJECTED",
      payload: { reason: "no good reason" },
    });
  });

  it("throws ValidationError when no projection exists yet", async () => {
    ddbMock.on(GetCommand).resolves({});

    await expect(orderDao.rejectOrder("01ORDER", "reason")).rejects.toThrow(ValidationError);
  });
});

describe("OrderDao.recordCaseCreated", () => {
  it("leaves status/current_stage/case_id untouched", async () => {
    ddbMock.on(GetCommand).resolves({ Item: makeOrderItem() });

    const order = await orderDao.recordCaseCreated("01ORDER", "unmanageable");

    expect(order).toMatchObject({ status: "CREATED", current_stage: "INGEST", case_id: null });
  });

  it("writes a CASE_CREATED event", async () => {
    ddbMock.on(GetCommand).resolves({ Item: makeOrderItem() });

    await orderDao.recordCaseCreated("01ORDER", "unmanageable");

    const transactInput = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input;
    expect(transactInput.TransactItems?.[0]?.Put?.Item).toMatchObject({
      event_type: "CASE_CREATED",
      payload: { reason: "unmanageable" },
    });
  });

  it("throws ValidationError when no projection exists yet", async () => {
    ddbMock.on(GetCommand).resolves({});

    await expect(orderDao.recordCaseCreated("01ORDER", "reason")).rejects.toThrow(ValidationError);
  });
});

describe("OrderDao.scheduleOrder", () => {
  const SCHEDULED_INPUT = {
    scheduledStart: "2026-08-28T12:00:00.000Z",
    scheduledEnd: "2026-08-28T12:50:00.000Z",
    operatorId: "01OPERATOR",
  };

  it("moves current_stage to EXECUTE, stamping the window and operator", async () => {
    ddbMock.on(GetCommand).resolves({
      Item: makeOrderItem({ current_stage: "SCHEDULE", status: "ACTIVE", sla_deadline: "2026-08-29T00:00:00.000Z" }),
    });

    const order = await orderDao.scheduleOrder("01ORDER", SCHEDULED_INPUT);

    expect(order).toMatchObject({
      current_stage: "EXECUTE",
      scheduled_start: SCHEDULED_INPUT.scheduledStart,
      scheduled_end: SCHEDULED_INPUT.scheduledEnd,
      assigned_operator_id: SCHEDULED_INPUT.operatorId,
    });
  });

  it("writes a single ORDER_SCHEDULED event carrying the window and operator, stage SCHEDULE", async () => {
    ddbMock.on(GetCommand).resolves({
      Item: makeOrderItem({ current_stage: "SCHEDULE", status: "ACTIVE", sla_deadline: "2026-08-29T00:00:00.000Z" }),
    });

    await orderDao.scheduleOrder("01ORDER", SCHEDULED_INPUT);

    const transactInput = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input;
    expect(transactInput.TransactItems?.[0]?.Put?.Item).toMatchObject({
      event_type: "ORDER_SCHEDULED",
      stage: "SCHEDULE",
      payload: {
        scheduled_start: SCHEDULED_INPUT.scheduledStart,
        scheduled_end: SCHEDULED_INPUT.scheduledEnd,
        operator_id: SCHEDULED_INPUT.operatorId,
      },
    });
  });

  it("re-stamps gsi1pk under the new stage (EXECUTE), keeping gsi1sk at the existing sla_deadline", async () => {
    ddbMock.on(GetCommand).resolves({
      Item: makeOrderItem({ current_stage: "SCHEDULE", status: "ACTIVE", sla_deadline: "2026-08-29T00:00:00.000Z" }),
    });

    await orderDao.scheduleOrder("01ORDER", SCHEDULED_INPUT);

    const transactInput = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input;
    expect(transactInput.TransactItems?.[1]?.Put?.Item).toMatchObject({
      gsi1pk: "STAGE#EXECUTE",
      gsi1sk: "2026-08-29T00:00:00.000Z",
    });
  });

  it("throws ValidationError when no projection exists yet", async () => {
    ddbMock.on(GetCommand).resolves({});

    await expect(orderDao.scheduleOrder("01ORDER", SCHEDULED_INPUT)).rejects.toThrow(ValidationError);
  });
});

describe("OrderDao.listOrdersWaitingForSchedule", () => {
  it("queries gsi1-stage-sla for STAGE#SCHEDULE, ascending by sla_deadline", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [makeOrderItem({ current_stage: "SCHEDULE" })] });

    const result = await orderDao.listOrdersWaitingForSchedule({ limit: 50 });

    expect(result.orders).toHaveLength(1);
    const queryInput = ddbMock.commandCalls(QueryCommand)[0].args[0].input;
    expect(queryInput).toMatchObject({
      IndexName: "gsi1-stage-sla",
      KeyConditionExpression: "gsi1pk = :stagePk",
      ExpressionAttributeValues: { ":stagePk": "STAGE#SCHEDULE" },
      ScanIndexForward: true,
      Limit: 50,
    });
  });

  it("round-trips an opaque cursor from LastEvaluatedKey", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [], LastEvaluatedKey: { order_id: "01ORDER", sk: "#METADATA" } });

    const result = await orderDao.listOrdersWaitingForSchedule({ limit: 50 });

    expect(result.nextCursor).not.toBeNull();

    ddbMock.on(QueryCommand).resolves({ Items: [] });
    await orderDao.listOrdersWaitingForSchedule({ limit: 50, cursor: result.nextCursor });
    const secondCall = ddbMock.commandCalls(QueryCommand)[1].args[0].input;
    expect(secondCall.ExclusiveStartKey).toEqual({ order_id: "01ORDER", sk: "#METADATA" });
  });

  it("returns nextCursor null once the query is exhausted", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });

    const result = await orderDao.listOrdersWaitingForSchedule({ limit: 50 });

    expect(result.nextCursor).toBeNull();
  });

  it("defaults to an empty orders array when the response has no Items at all", async () => {
    ddbMock.on(QueryCommand).resolves({});

    const result = await orderDao.listOrdersWaitingForSchedule({ limit: 50 });

    expect(result.orders).toEqual([]);
  });
});

function makeOrderEventItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    order_id: "01ORDER",
    sk: "EVENT#0",
    sequence_number: 0,
    event_type: "ORDER_CREATED",
    stage: null,
    payload: {},
    occurred_at: "2026-08-20T00:00:00.000Z",
    actor: "SYSTEM",
    ...overrides,
  };
}

describe("OrderDao.listOrderEvents", () => {
  it("queries the given order's partition for EVENT# items, newest first", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [makeOrderEventItem()] });

    const result = await orderDao.listOrderEvents({ limit: 20, orderId: "01ORDER" });

    expect(result.events).toHaveLength(1);
    const input = ddbMock.commandCalls(QueryCommand)[0].args[0].input;
    expect(input.KeyConditionExpression).toBe("order_id = :orderId AND begins_with(sk, :eventPrefix)");
    expect(input.ExpressionAttributeValues).toMatchObject({ ":orderId": "01ORDER", ":eventPrefix": "EVENT#" });
    expect(input.ScanIndexForward).toBe(false);
  });

  it("adds an event_type filter to the Query when given", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });

    await orderDao.listOrderEvents({ limit: 20, orderId: "01ORDER", eventType: "ORDER_ACCEPTED" });

    const input = ddbMock.commandCalls(QueryCommand)[0].args[0].input;
    expect(input.FilterExpression).toBe("event_type = :eventType");
    expect(input.ExpressionAttributeValues).toMatchObject({ ":eventType": "ORDER_ACCEPTED" });
  });

  it("scans table-wide for EVENT# items when no orderId is given, sorted by occurred_at descending", async () => {
    ddbMock.on(ScanCommand).resolves({
      Items: [
        makeOrderEventItem({ occurred_at: "2026-08-20T00:00:00.000Z", sequence_number: 0 }),
        makeOrderEventItem({ occurred_at: "2026-08-21T00:00:00.000Z", sequence_number: 1, sk: "EVENT#1" }),
      ],
    });

    const result = await orderDao.listOrderEvents({ limit: 20 });

    expect(result.events.map((e) => e.occurred_at)).toEqual(["2026-08-21T00:00:00.000Z", "2026-08-20T00:00:00.000Z"]);
    const input = ddbMock.commandCalls(ScanCommand)[0].args[0].input;
    expect(input.FilterExpression).toBe("begins_with(sk, :eventPrefix)");
  });

  it("adds an event_type filter to the Scan when given", async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [] });

    await orderDao.listOrderEvents({ limit: 20, eventType: "ORDER_REJECTED" });

    const input = ddbMock.commandCalls(ScanCommand)[0].args[0].input;
    expect(input.FilterExpression).toBe("begins_with(sk, :eventPrefix) AND event_type = :eventType");
  });

  it("decodes/encodes cursors for both the Query and Scan paths", async () => {
    const lastKey = { order_id: "01ORDER", sk: "EVENT#0" };
    ddbMock.on(QueryCommand).resolves({ Items: [], LastEvaluatedKey: lastKey });
    const incomingCursor = Buffer.from(JSON.stringify({ order_id: "01ORDER", sk: "EVENT#-1" })).toString("base64url");

    const result = await orderDao.listOrderEvents({ limit: 20, orderId: "01ORDER", cursor: incomingCursor });

    const input = ddbMock.commandCalls(QueryCommand)[0].args[0].input;
    expect(input.ExclusiveStartKey).toEqual({ order_id: "01ORDER", sk: "EVENT#-1" });
    expect(result.nextCursor).not.toBeNull();
  });

  it("decodes an incoming cursor on the table-wide Scan path too", async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [] });
    const incomingCursor = Buffer.from(JSON.stringify({ order_id: "00PREV", sk: "EVENT#0" })).toString("base64url");

    await orderDao.listOrderEvents({ limit: 20, cursor: incomingCursor });

    const input = ddbMock.commandCalls(ScanCommand)[0].args[0].input;
    expect(input.ExclusiveStartKey).toEqual({ order_id: "00PREV", sk: "EVENT#0" });
  });

  it("throws ValidationError when a listed item fails OrderEventSchema validation", async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [{ order_id: "01ORDER", sk: "EVENT#0" }] });

    await expect(orderDao.listOrderEvents({ limit: 20 })).rejects.toThrow(ValidationError);
  });

  it("treats a response with no Items as an empty page, for both paths", async () => {
    ddbMock.on(ScanCommand).resolves({});
    ddbMock.on(QueryCommand).resolves({});

    await expect(orderDao.listOrderEvents({ limit: 20 })).resolves.toEqual({ events: [], nextCursor: null });
    await expect(orderDao.listOrderEvents({ limit: 20, orderId: "01ORDER" })).resolves.toEqual({
      events: [],
      nextCursor: null,
    });
  });
});
