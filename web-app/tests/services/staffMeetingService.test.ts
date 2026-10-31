import { afterEach, describe, expect, it, vi } from "vitest";
import { MOCK_STAFF_MEETINGS } from "../../src/test-data/staffMeetings";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetModules();
});

async function load(dataMode: string, teamMode = "") {
  vi.stubEnv("VITE_DATA_MODE", dataMode);
  vi.stubEnv("VITE_TEAM_DATA_MODE", teamMode);
  vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
  return (await import("../../src/services/staffMeetingService")).staffMeetingService;
}

describe("staffMeetingService — mock", () => {
  it("lists every sample meeting newest first, as copies", async () => {
    vi.useFakeTimers();
    const service = await load("mock");
    const pending = service.listMeetings();
    await vi.runAllTimersAsync();
    const page = await pending;
    expect(page.items.map((meeting) => meeting.held_on)).toEqual(["2026-10-31", "2026-10-30", "2026-10-29"]);
    expect(page.nextCursor).toBeNull();
    expect(page.items[0]).not.toBe(MOCK_STAFF_MEETINGS[0]);
  });

  it("is used by a live-mode build when VITE_TEAM_DATA_MODE asks for mocks", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
    const service = await load("live", "mock");
    const pending = service.listMeetings();
    await vi.runAllTimersAsync();
    await pending;
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("staffMeetingService — live", () => {
  it("calls GET /team/staff-meetings and parses the page", async () => {
    const page = { items: MOCK_STAFF_MEETINGS, nextCursor: null };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => page }));
    const service = await load("live");
    await expect(service.listMeetings()).resolves.toEqual(page);
    expect(fetch).toHaveBeenCalledWith("https://api.example.com/team/staff-meetings");
  });

  it("throws on a non-2xx response and on a malformed body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }));
    let service = await load("live");
    await expect(service.listMeetings()).rejects.toThrow("GET /team/staff-meetings failed: HTTP 404");
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ nope: 1 }) }));
    service = await load("live");
    await expect(service.listMeetings()).rejects.toThrow();
  });
});
