import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listOrderEvents } from "../../../service/order/orderService";
import { getOrderEventsController } from "../../../controller/web-api/getOrderEventsController";
import { ValidationError } from "../../../models/errors";
import type { OrderEventListResult } from "../../../models/orderEventListQuery";

vi.mock("../../../service/order/orderService", () => ({
  listOrderEvents: vi.fn(),
}));

const mockedListOrderEvents = vi.mocked(listOrderEvents);

const validEvent = {
  rawPath: "/order-events",
  requestContext: { http: { method: "GET" } },
  queryStringParameters: null,
};

const emptyResult: OrderEventListResult = { events: [], nextCursor: null };

beforeEach(() => {
  mockedListOrderEvents.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getOrderEventsController", () => {
  it("validates the event, calls listOrderEvents with an empty query, and returns 200 with the result", async () => {
    mockedListOrderEvents.mockResolvedValue(emptyResult);

    const result = await getOrderEventsController(validEvent);

    expect(result.statusCode).toBe(200);
    expect(result.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(result.body as string)).toEqual(emptyResult);
    expect(mockedListOrderEvents).toHaveBeenCalledWith({});
  });

  it("parses query string params (limit, cursor, order_id, event_type) into a typed query", async () => {
    mockedListOrderEvents.mockResolvedValue(emptyResult);

    await getOrderEventsController({
      ...validEvent,
      queryStringParameters: { limit: "5", cursor: "opaque", order_id: "01ORDER", event_type: "ORDER_ACCEPTED" },
    });

    expect(mockedListOrderEvents).toHaveBeenCalledWith({
      limit: 5,
      cursor: "opaque",
      order_id: "01ORDER",
      event_type: "ORDER_ACCEPTED",
    });
  });

  it("returns 400 without calling listOrderEvents for a malformed event", async () => {
    const result = await getOrderEventsController({ not: "an api gateway event" });

    expect(result.statusCode).toBe(400);
    expect(mockedListOrderEvents).not.toHaveBeenCalled();
  });

  it("returns 400 without calling listOrderEvents for a malformed query string", async () => {
    const result = await getOrderEventsController({ ...validEvent, queryStringParameters: { limit: "not-a-number" } });

    expect(result.statusCode).toBe(400);
    expect(mockedListOrderEvents).not.toHaveBeenCalled();
  });

  it("returns 400 when the service throws a ValidationError", async () => {
    mockedListOrderEvents.mockRejectedValue(new ValidationError("bad cursor"));

    const result = await getOrderEventsController(validEvent);

    expect(result.statusCode).toBe(400);
  });

  it("returns 500 for any other failure", async () => {
    mockedListOrderEvents.mockRejectedValue(new Error("DynamoDB throttled"));

    const result = await getOrderEventsController(validEvent);

    expect(result.statusCode).toBe(500);
  });

  it("returns 500 and logs a thrown non-Error value", async () => {
    mockedListOrderEvents.mockRejectedValue("string rejection");

    const result = await getOrderEventsController(validEvent);

    expect(result.statusCode).toBe(500);
  });
});
