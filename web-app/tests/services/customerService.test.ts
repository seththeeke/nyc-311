import { afterEach, describe, expect, it, vi } from "vitest";
import { MOCK_CUSTOMER_IDEAS } from "../../src/test-data/customerIdeas";
import { MOCK_CUSTOMER_PERSONAS } from "../../src/test-data/customerPersonas";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetModules();
});

async function mockService() {
  vi.stubEnv("VITE_DATA_MODE", "mock");
  vi.stubEnv("VITE_CUSTOMER_DATA_MODE", "");
  vi.useFakeTimers();
  return (await import("../../src/services/customerService")).customerService;
}

/* Resolves a mock call past its simulated latency. */
async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return promise;
}

describe("customerService — mock", () => {
  it("lists every persona on one page", async () => {
    const service = await mockService();
    const page = await settle(service.listPersonas());
    expect(page).toEqual({ items: MOCK_CUSTOMER_PERSONAS, nextCursor: null });
  });

  it("gets one persona, or fails like a 404", async () => {
    const service = await mockService();
    await expect(settle(service.getPersona("juniper"))).resolves.toMatchObject({ name: "Juniper" });
    const missing = service.getPersona("nobody");
    const assertion = expect(missing).rejects.toThrow("HTTP 404");
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("lists every idea newest first, or one persona's", async () => {
    const service = await mockService();
    const all = await settle(service.listIdeas());
    expect(all.items).toHaveLength(MOCK_CUSTOMER_IDEAS.length);
    expect(all.items.map((idea) => idea.created_at)).toEqual([...all.items.map((idea) => idea.created_at)].sort().reverse());
    const hawthorn = await settle(service.listIdeas({ personaId: "hawthorn" }));
    expect(hawthorn.items.every((idea) => idea.persona_id === "hawthorn")).toBe(true);
    expect(hawthorn.nextCursor).toBeNull();
  });

  it("is used by a live-mode build when VITE_CUSTOMER_DATA_MODE asks for mocks", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_CUSTOMER_DATA_MODE", "mock");
    vi.stubGlobal("fetch", vi.fn());
    vi.useFakeTimers();
    const { customerService } = await import("../../src/services/customerService");
    await settle(customerService.listPersonas());
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("customerService — live", () => {
  async function liveService(body: unknown, ok = true, status = 200) {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_CUSTOMER_DATA_MODE", "");
    vi.stubEnv("VITE_CUSTOMER_API_BASE_URL", "https://customer.example.com");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok, status, json: async () => body }));
    return (await import("../../src/services/customerService")).customerService;
  }

  it("calls the planned routes on the customer API and parses each response", async () => {
    const page = { items: MOCK_CUSTOMER_PERSONAS, nextCursor: null };
    let service = await liveService(page);
    await expect(service.listPersonas()).resolves.toEqual(page);
    expect(fetch).toHaveBeenLastCalledWith("https://customer.example.com/customers");

    vi.resetModules();
    service = await liveService(MOCK_CUSTOMER_PERSONAS[0]);
    await expect(service.getPersona("hawthorn")).resolves.toEqual(MOCK_CUSTOMER_PERSONAS[0]);
    expect(fetch).toHaveBeenLastCalledWith("https://customer.example.com/customers/hawthorn");
  });

  it("lists ideas from /ideas or /customers/{id}/ideas, passing a cursor through", async () => {
    const service = await liveService({ items: MOCK_CUSTOMER_IDEAS, nextCursor: "next" });
    await expect(service.listIdeas()).resolves.toMatchObject({ nextCursor: "next" });
    expect(fetch).toHaveBeenLastCalledWith("https://customer.example.com/ideas");
    await service.listIdeas({ personaId: "sycamore", cursor: "a b" });
    expect(fetch).toHaveBeenLastCalledWith("https://customer.example.com/customers/sycamore/ideas?cursor=a%20b");
  });

  it("throws on a non-2xx response and on a malformed body", async () => {
    let service = await liveService({}, false, 404);
    await expect(service.listPersonas()).rejects.toThrow("Customer API /customers failed: HTTP 404");
    vi.resetModules();
    service = await liveService({ not: "a page" });
    await expect(service.listIdeas()).rejects.toThrow();
  });

  it("defaults to the customer stack's own host", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_CUSTOMER_DATA_MODE", "");
    vi.stubEnv("VITE_CUSTOMER_API_BASE_URL", "");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [], nextCursor: null }) }));
    const { customerService } = await import("../../src/services/customerService");
    await customerService.listPersonas();
    expect(fetch).toHaveBeenCalledWith("https://customer-api.boroughsim.com/customers");
  });
});
