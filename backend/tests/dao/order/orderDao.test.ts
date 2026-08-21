import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderDao } from "../../../dao/order/orderDao";

const TABLE_NAME = "Orders";
const ddbMock = mockClient(DynamoDBDocumentClient);
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const orderDao = new OrderDao(client, TABLE_NAME);

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
