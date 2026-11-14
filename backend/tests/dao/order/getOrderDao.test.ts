import { afterEach, describe, expect, it, vi } from "vitest";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { OrderDao } from "../../../dao/order/orderDao";
import { getOrderDao } from "../../../dao/order/getOrderDao";

describe("getOrderDao", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds a new OrderDao on every call", () => {
    vi.stubEnv("ORDERS_TABLE_NAME", "Orders-Test");
    const dao = getOrderDao();
    expect(dao).toBeInstanceOf(OrderDao);
    expect(getOrderDao()).not.toBe(dao);
  });

  it("uses the client it is given", async () => {
    vi.stubEnv("ORDERS_TABLE_NAME", "Orders-Test");
    const send = vi.fn().mockResolvedValue({});
    await getOrderDao({ send } as unknown as DynamoDBDocumentClient).getOrder("order-1");
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({ TableName: "Orders-Test" }) }));
  });

  it("throws when ORDERS_TABLE_NAME is missing", () => {
    vi.stubEnv("ORDERS_TABLE_NAME", "");
    expect(() => getOrderDao()).toThrow("ORDERS_TABLE_NAME");
  });
});
