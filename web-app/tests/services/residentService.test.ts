import { afterEach, describe, expect, it, vi } from "vitest";
import { MOCK_RESIDENT_IDEAS } from "../../src/test-data/residentIdeas";
import { MOCK_RESIDENT_PERSONAS } from "../../src/test-data/residentPersonas";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetModules();
});

async function mockService() {
  vi.stubEnv("VITE_DATA_MODE", "mock");
  vi.stubEnv("VITE_RESIDENT_DATA_MODE", "");
  vi.useFakeTimers();
  return (await import("../../src/services/residentService")).residentService;
}

/* Resolves a mock call past its simulated latency. */
async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return promise;
}

describe("residentService — mock", () => {
  it("lists every persona on one page", async () => {
    const service = await mockService();
    const page = await settle(service.listPersonas());
    expect(page).toEqual({ items: MOCK_RESIDENT_PERSONAS, nextCursor: null });
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
    const first = await settle(service.listIdeas());
    expect(first.items).toHaveLength(10);
    expect(first.nextCursor).toBe("10");
    const rest = await settle(service.listIdeas({ cursor: first.nextCursor ?? undefined }));
    expect(rest.nextCursor).toBeNull();
    const all = [...first.items, ...rest.items];
    expect(all).toHaveLength(MOCK_RESIDENT_IDEAS.length);
    expect(all.map((idea) => idea.created_at)).toEqual([...all.map((idea) => idea.created_at)].sort().reverse());
    const hawthorn = await settle(service.listIdeas({ personaId: "hawthorn" }));
    expect(hawthorn.items.every((idea) => idea.persona_id === "hawthorn")).toBe(true);
    expect(hawthorn.nextCursor).toBeNull();
  });

  it("gets one idea by resident and id, or fails like a 404", async () => {
    const service = await mockService();
    await expect(settle(service.getIdea("hawthorn", "01K7IDEA0014"))).resolves.toMatchObject({ idea_type: "ESCALATION" });
    const wrongResident = service.getIdea("juniper", "01K7IDEA0014");
    const assertion = expect(wrongResident).rejects.toThrow("HTTP 404");
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("is used by a live-mode build when VITE_RESIDENT_DATA_MODE asks for mocks", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_RESIDENT_DATA_MODE", "mock");
    vi.stubGlobal("fetch", vi.fn());
    vi.useFakeTimers();
    const { residentService } = await import("../../src/services/residentService");
    await settle(residentService.listPersonas());
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("residentService — live", () => {
  async function liveService(body: unknown, ok = true, status = 200) {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_RESIDENT_DATA_MODE", "");
    vi.stubEnv("VITE_RESIDENT_API_BASE_URL", "https://api.example.com");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok, status, json: async () => body }));
    return (await import("../../src/services/residentService")).residentService;
  }

  it("calls the planned routes on the resident API and parses each response", async () => {
    const page = { items: MOCK_RESIDENT_PERSONAS, nextCursor: null };
    let service = await liveService(page);
    await expect(service.listPersonas()).resolves.toEqual(page);
    expect(fetch).toHaveBeenLastCalledWith("https://api.example.com/residents");

    vi.resetModules();
    service = await liveService(MOCK_RESIDENT_PERSONAS[0]);
    await expect(service.getPersona("hawthorn")).resolves.toEqual(MOCK_RESIDENT_PERSONAS[0]);
    expect(fetch).toHaveBeenLastCalledWith("https://api.example.com/residents/hawthorn");
  });

  it("lists ideas from /ideas or /residents/{id}/ideas, passing a cursor through", async () => {
    const service = await liveService({ items: MOCK_RESIDENT_IDEAS, nextCursor: "next" });
    await expect(service.listIdeas()).resolves.toMatchObject({ nextCursor: "next" });
    expect(fetch).toHaveBeenLastCalledWith("https://api.example.com/ideas");
    await service.listIdeas({ personaId: "sycamore", cursor: "a b" });
    expect(fetch).toHaveBeenLastCalledWith("https://api.example.com/residents/sycamore/ideas?cursor=a%20b");
  });

  it("gets one idea from /residents/{id}/ideas/{ideaId}", async () => {
    const service = await liveService({ ...MOCK_RESIDENT_IDEAS[0], steps: [] });
    await expect(service.getIdea("hawthorn", "01K7IDEA0014")).resolves.toEqual({ ...MOCK_RESIDENT_IDEAS[0], steps: [] });
    expect(fetch).toHaveBeenLastCalledWith("https://api.example.com/residents/hawthorn/ideas/01K7IDEA0014");
  });

  it("throws on a non-2xx response and on a malformed body", async () => {
    let service = await liveService({}, false, 404);
    await expect(service.listPersonas()).rejects.toThrow("Resident API /residents failed: HTTP 404");
    vi.resetModules();
    service = await liveService({ not: "a page" });
    await expect(service.listIdeas()).rejects.toThrow();
  });

  it("defaults to the customer stack's own host", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_RESIDENT_DATA_MODE", "");
    vi.stubEnv("VITE_RESIDENT_API_BASE_URL", "");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [], nextCursor: null }) }));
    const { residentService } = await import("../../src/services/residentService");
    await residentService.listPersonas();
    expect(fetch).toHaveBeenCalledWith("https://customer-api.boroughsim.com/residents");
  });
});
