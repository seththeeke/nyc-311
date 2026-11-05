import { afterEach, describe, expect, it, vi } from "vitest";
import { MOCK_CONTACTS } from "../../src/test-data/contacts";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function service(mode: "mock" | "live") {
  vi.stubEnv("VITE_DATA_MODE", mode);
  return (await import("../../src/services/contactService")).contactService;
}

describe("contactService — mock", () => {
  it("filters by type and status, sorts, and pages two at a time", async () => {
    const contacts = await service("mock");
    const first = await contacts.listContacts({ type: "FEATURE_REQUEST", status: null, order: "NEWEST" }, null);
    expect(first.contacts.map((c) => c.contact_id)).toEqual([MOCK_CONTACTS[0].contact_id, MOCK_CONTACTS[1].contact_id]);
    expect(first.next_cursor).toBe("2");
    const second = await contacts.listContacts({ type: "FEATURE_REQUEST", status: null, order: "NEWEST" }, "2");
    expect(second).toEqual({ contacts: [MOCK_CONTACTS[2]], next_cursor: null });
    const oldest = await contacts.listContacts({ type: "FEATURE_REQUEST", status: null, order: "OLDEST" }, null);
    expect(oldest.contacts[0].contact_id).toBe(MOCK_CONTACTS[2].contact_id);
    expect((await contacts.listContacts({ type: "FEATURE_REQUEST", status: "CLOSED", order: "NEWEST" }, null)).contacts).toEqual([MOCK_CONTACTS[2]]);
  });
});

describe("contactService — live", () => {
  it("calls GET /contacts with the filters and cursor, and parses the page", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ contacts: [MOCK_CONTACTS[0]], next_cursor: null }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const contacts = await service("live");
    expect(await contacts.listContacts({ type: "FEATURE_REQUEST", status: "RECEIVED", order: "OLDEST" }, "abc")).toEqual({ contacts: [MOCK_CONTACTS[0]], next_cursor: null });
    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]));
    expect(url.pathname).toBe("/contacts");
    expect(Object.fromEntries(url.searchParams)).toEqual({ type: "FEATURE_REQUEST", order: "OLDEST", limit: "25", status: "RECEIVED", cursor: "abc" });
    await contacts.listContacts({ type: "FEATURE_REQUEST", status: null, order: "NEWEST" }, null);
    const second = new URL(String((fetchMock.mock.calls[1] as unknown[])[0]));
    expect(second.searchParams.has("status")).toBe(false);
    expect(second.searchParams.has("cursor")).toBe(false);
  });

  it("throws on a failed response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    await expect((await service("live")).listContacts({ type: "FEATURE_REQUEST", status: null, order: "NEWEST" }, null)).rejects.toThrow("HTTP 500");
  });
});
