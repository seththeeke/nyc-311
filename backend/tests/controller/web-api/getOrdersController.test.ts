import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listOrders } from "../../../service/order/orderService";
import { getOrdersController } from "../../../controller/web-api/getOrdersController";
import { ValidationError } from "../../../models/errors";
import type { OrderListResult } from "../../../models/orderListQuery";

vi.mock("../../../service/order/orderService", () => ({
  listOrders: vi.fn(),
}));

const mockedListOrders = vi.mocked(listOrders);

const validEvent = {
  rawPath: "/orders",
  requestContext: { http: { method: "GET" } },
  queryStringParameters: null,
};

const emptyResult: OrderListResult = { orders: [], nextCursor: null };

beforeEach(() => {
  mockedListOrders.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getOrdersController", () => {
  it("validates the event, calls listOrders with an empty query, and returns 200 with the result", async () => {
    mockedListOrders.mockResolvedValue(emptyResult);

    const result = await getOrdersController(validEvent);

    expect(result.statusCode).toBe(200);
    expect(result.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(result.body as string)).toEqual(emptyResult);
    expect(mockedListOrders).toHaveBeenCalledWith({});
  });

  it("parses query string params (limit, cursor, stage, status) into a typed query", async () => {
    mockedListOrders.mockResolvedValue(emptyResult);

    await getOrdersController({
      ...validEvent,
      queryStringParameters: { limit: "5", cursor: "opaque", stage: "INGEST", status: "CREATED" },
    });

    expect(mockedListOrders).toHaveBeenCalledWith({ limit: 5, cursor: "opaque", stage: "INGEST", status: "CREATED" });
  });

  it("returns 400 without calling listOrders for a malformed event", async () => {
    const result = await getOrdersController({ not: "an api gateway event" });

    expect(result.statusCode).toBe(400);
    expect(mockedListOrders).not.toHaveBeenCalled();
  });

  it("returns 400 without calling listOrders for a malformed query string", async () => {
    const result = await getOrdersController({ ...validEvent, queryStringParameters: { limit: "not-a-number" } });

    expect(result.statusCode).toBe(400);
    expect(mockedListOrders).not.toHaveBeenCalled();
  });

  it("returns 400 when the service throws a ValidationError", async () => {
    mockedListOrders.mockRejectedValue(new ValidationError("bad cursor"));

    const result = await getOrdersController(validEvent);

    expect(result.statusCode).toBe(400);
  });

  it("returns 500 for any other failure", async () => {
    mockedListOrders.mockRejectedValue(new Error("DynamoDB throttled"));

    const result = await getOrdersController(validEvent);

    expect(result.statusCode).toBe(500);
  });

  it("returns 500 and logs a thrown non-Error value", async () => {
    mockedListOrders.mockRejectedValue("string rejection");

    const result = await getOrdersController(validEvent);

    expect(result.statusCode).toBe(500);
  });
});
