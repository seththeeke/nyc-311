import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderDao } from "../../../dao/order/orderDao";
import { listOrders } from "../../../service/order/orderService";
import { DEFAULT_ORDER_PAGE_SIZE } from "../../../models/orderListQuery";

const TABLE_NAME = "Orders";
const ddbMock = mockClient(DynamoDBDocumentClient);
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const orderDao = new OrderDao(client, TABLE_NAME);

beforeEach(() => {
  ddbMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("listOrders", () => {
  it("falls back to the module's own default OrderDao when deps.orderDao is omitted", async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [] });

    await expect(listOrders({})).resolves.toEqual({ orders: [], nextCursor: null });
  });

  it("applies the default page size when the query omits limit", async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [] });

    await listOrders({}, { orderDao });

    const input = ddbMock.commandCalls(ScanCommand)[0].args[0].input;
    expect(input.Limit).toBe(DEFAULT_ORDER_PAGE_SIZE);
  });

  it("passes limit, cursor, stage, and status straight through to the DAO", async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [] });
    const cursor = Buffer.from(JSON.stringify({ order_id: "00PREV", sk: "#METADATA" })).toString("base64url");

    await listOrders({ limit: 5, cursor, stage: "INGEST", status: "CREATED" }, { orderDao });

    const input = ddbMock.commandCalls(ScanCommand)[0].args[0].input;
    expect(input.Limit).toBe(5);
    expect(input.ExclusiveStartKey).toEqual({ order_id: "00PREV", sk: "#METADATA" });
    expect(input.FilterExpression).toContain("current_stage = :stage");
    expect(input.FilterExpression).toContain("#status = :status");
  });

  it("returns the DAO's orders and nextCursor unchanged", async () => {
    const lastKey = { order_id: "01ORDER", sk: "#METADATA" };
    ddbMock.on(ScanCommand).resolves({ Items: [], LastEvaluatedKey: lastKey });

    const result = await listOrders({}, { orderDao });

    expect(result.orders).toEqual([]);
    expect(result.nextCursor).not.toBeNull();
  });
});

describe("module wiring", () => {
  it("throws at load time when ORDERS_TABLE_NAME is unset", async () => {
    const previous = process.env.ORDERS_TABLE_NAME;
    delete process.env.ORDERS_TABLE_NAME;
    vi.resetModules();

    await expect(import("../../../service/order/orderService.js")).rejects.toThrow(
      "Missing required environment variable: ORDERS_TABLE_NAME"
    );

    process.env.ORDERS_TABLE_NAME = previous;
    vi.resetModules();
  });
});
