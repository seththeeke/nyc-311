import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("orderEventService", () => {
  it("mock mode returns a first page from the baked test-data fixtures", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { orderEventService } = await import("../../src/services/orderEventService");
    const { MOCK_ORDER_EVENTS } = await import("../../src/test-data/orderEvents");

    const result = await orderEventService.listOrderEvents({ limit: 5 });

    expect(result.events).toEqual(MOCK_ORDER_EVENTS.slice(0, 5));
    expect(result.nextCursor).toBe("5");
  });

  it("mock mode filters by order_id and returns null nextCursor once exhausted", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { orderEventService } = await import("../../src/services/orderEventService");
    const { MOCK_ORDER_EVENTS } = await import("../../src/test-data/orderEvents");
    const targetOrderId = MOCK_ORDER_EVENTS[0]?.order_id as string;

    const result = await orderEventService.listOrderEvents({ limit: 1000, order_id: targetOrderId });

    expect(result.events.length).toBeGreaterThan(0);
    expect(result.events.every((event) => event.order_id === targetOrderId)).toBe(true);
    expect(result.events).toEqual(MOCK_ORDER_EVENTS.filter((event) => event.order_id === targetOrderId));
    expect(result.nextCursor).toBeNull();
  });

  it("mock mode filters by event_type", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { orderEventService } = await import("../../src/services/orderEventService");
    const { MOCK_ORDER_EVENTS } = await import("../../src/test-data/orderEvents");

    const result = await orderEventService.listOrderEvents({ limit: 1000, event_type: "ORDER_ACCEPTED" });

    expect(result.events).toEqual(MOCK_ORDER_EVENTS.filter((event) => event.event_type === "ORDER_ACCEPTED"));
  });

  it("mock mode applies a default page size when limit is omitted", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { orderEventService } = await import("../../src/services/orderEventService");

    const result = await orderEventService.listOrderEvents({});

    expect(result.events.length).toBeGreaterThan(0);
    expect(result.events.length).toBeLessThanOrEqual(20);
  });

  it("mock mode resumes from an opaque cursor", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { orderEventService } = await import("../../src/services/orderEventService");
    const { MOCK_ORDER_EVENTS } = await import("../../src/test-data/orderEvents");

    const result = await orderEventService.listOrderEvents({ limit: 5, cursor: "5" });

    expect(result.events).toEqual(MOCK_ORDER_EVENTS.slice(5, 10));
  });

  it("live mode fetches from config.apiBaseUrl + /order-events with the given params and parses the response", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    const events = [
      {
        order_id: "01ORDER",
        sequence_number: 0,
        event_type: "ORDER_CREATED",
        stage: null,
        payload: {},
        occurred_at: "2026-08-26T00:00:00.000Z",
        actor: "SYSTEM",
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ events, nextCursor: null }) });
    vi.stubGlobal("fetch", fetchMock);

    const { orderEventService } = await import("../../src/services/orderEventService");

    const result = await orderEventService.listOrderEvents({
      limit: 5,
      cursor: "abc",
      order_id: "01ORDER",
      event_type: "ORDER_CREATED",
    });

    expect(result).toEqual({ events, nextCursor: null });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/order-events?limit=5&cursor=abc&order_id=01ORDER&event_type=ORDER_CREATED"
    );
  });

  it("live mode omits query params that weren't given", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ events: [], nextCursor: null }) });
    vi.stubGlobal("fetch", fetchMock);

    const { orderEventService } = await import("../../src/services/orderEventService");

    await orderEventService.listOrderEvents({});

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/order-events");
  });

  it("live mode throws a descriptive error when the response is not ok", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const { orderEventService } = await import("../../src/services/orderEventService");

    await expect(orderEventService.listOrderEvents({})).rejects.toThrow("HTTP 500");
  });

  it("live mode throws when the response body fails schema validation", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ not: "valid" }) }));

    const { orderEventService } = await import("../../src/services/orderEventService");

    await expect(orderEventService.listOrderEvents({})).rejects.toThrow();
  });
});
