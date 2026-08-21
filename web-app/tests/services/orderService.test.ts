import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("orderService", () => {
  it("mock mode returns a first page from the baked test-data fixtures", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { orderService } = await import("../../src/services/orderService");
    const { MOCK_ORDERS } = await import("../../src/test-data/orders");

    const result = await orderService.listOrders({ limit: 5 });

    expect(result.orders).toEqual(MOCK_ORDERS.slice(0, 5));
    expect(result.nextCursor).toBe("5");
  });

  it("mock mode filters by stage and returns null nextCursor once exhausted", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { orderService } = await import("../../src/services/orderService");
    const { MOCK_ORDERS } = await import("../../src/test-data/orders");

    const result = await orderService.listOrders({ limit: 1000, stage: "INGEST" });

    expect(result.orders.length).toBeGreaterThan(0);
    expect(result.orders.every((order) => order.current_stage === "INGEST")).toBe(true);
    expect(result.orders).toEqual(MOCK_ORDERS.filter((order) => order.current_stage === "INGEST"));
    expect(result.nextCursor).toBeNull();
  });

  it("mock mode filters by status", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { orderService } = await import("../../src/services/orderService");
    const { MOCK_ORDERS } = await import("../../src/test-data/orders");

    const result = await orderService.listOrders({ limit: 1000, status: "CREATED" });

    expect(result.orders).toEqual(MOCK_ORDERS.filter((order) => order.status === "CREATED"));
  });

  it("mock mode applies a default page size when limit is omitted", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { orderService } = await import("../../src/services/orderService");

    const result = await orderService.listOrders({});

    expect(result.orders.length).toBeGreaterThan(0);
    expect(result.orders.length).toBeLessThanOrEqual(20);
  });

  it("mock mode resumes from an opaque cursor", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { orderService } = await import("../../src/services/orderService");
    const { MOCK_ORDERS } = await import("../../src/test-data/orders");

    const result = await orderService.listOrders({ limit: 5, cursor: "5" });

    expect(result.orders).toEqual(MOCK_ORDERS.slice(5, 10));
  });

  it("live mode fetches from config.apiBaseUrl + /orders with the given params and parses the response", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    const orders = [
      {
        order_id: "01ORDER",
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
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ orders, nextCursor: null }) });
    vi.stubGlobal("fetch", fetchMock);

    const { orderService } = await import("../../src/services/orderService");

    const result = await orderService.listOrders({ limit: 5, cursor: "abc", stage: "INGEST", status: "CREATED" });

    expect(result).toEqual({ orders, nextCursor: null });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/orders?limit=5&cursor=abc&stage=INGEST&status=CREATED"
    );
  });

  it("live mode omits query params that weren't given", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ orders: [], nextCursor: null }) });
    vi.stubGlobal("fetch", fetchMock);

    const { orderService } = await import("../../src/services/orderService");

    await orderService.listOrders({});

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/orders");
  });

  it("live mode throws a descriptive error when the response is not ok", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const { orderService } = await import("../../src/services/orderService");

    await expect(orderService.listOrders({})).rejects.toThrow("HTTP 500");
  });

  it("live mode throws when the response body fails schema validation", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ not: "valid" }) }));

    const { orderService } = await import("../../src/services/orderService");

    await expect(orderService.listOrders({})).rejects.toThrow();
  });
});
