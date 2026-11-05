import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contactsApiRouter } from "../../../../controller/web-api/contacts/contactsApiRouter";
import { CONTACTS_API_ROUTES } from "../../../../controller/web-api/contacts/contactsApiRoutes";
import { listContactsController } from "../../../../controller/web-api/contacts/listContactsController";
import { ValidationError } from "../../../../models/errors";
import { listContacts } from "../../../../service/contact/contactService";

vi.mock("../../../../service/contact/contactService", () => ({ listContacts: vi.fn() }));
const mockedList = vi.mocked(listContacts);

function event(query?: Record<string, string>): unknown {
  return { routeKey: "GET /contacts", rawPath: "/contacts", requestContext: { http: { method: "GET" } }, queryStringParameters: query };
}

beforeEach(() => {
  mockedList.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("contacts bundle", () => {
  it("routes only GET /contacts, and 404s anything else", async () => {
    expect([...CONTACTS_API_ROUTES]).toEqual(["GET /contacts"]);
    mockedList.mockResolvedValue({ contacts: [], next_cursor: null });
    expect((await contactsApiRouter(event())).statusCode).toBe(200);
    expect((await contactsApiRouter({ routeKey: "GET /admin/whoami", requestContext: {} })).statusCode).toBe(404);
  });

  it("parses the query with defaults and returns the page", async () => {
    mockedList.mockResolvedValue({ contacts: [], next_cursor: "abc" });
    const response = await listContactsController(event({ status: "RECEIVED", order: "OLDEST", limit: "10" }));
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body as string)).toEqual({ contacts: [], next_cursor: "abc" });
    expect(mockedList).toHaveBeenCalledWith({ type: "FEATURE_REQUEST", status: "RECEIVED", order: "OLDEST", limit: 10 });
  });

  it("returns 400 for a malformed event or an invalid query", async () => {
    expect((await listContactsController({})).statusCode).toBe(400);
    expect((await listContactsController(event({ limit: "500" }))).statusCode).toBe(400);
    expect((await listContactsController(event({ status: "OPEN" }))).statusCode).toBe(400);
    expect(mockedList).not.toHaveBeenCalled();
  });

  it("returns 400 for a bad cursor and 500 for anything else", async () => {
    mockedList.mockRejectedValueOnce(new ValidationError("Malformed Contact list cursor"));
    expect((await listContactsController(event({ cursor: "nope" }))).statusCode).toBe(400);
    mockedList.mockRejectedValueOnce(new Error("boom"));
    expect((await listContactsController(event())).statusCode).toBe(500);
    mockedList.mockRejectedValueOnce("boom");
    expect((await listContactsController(event())).statusCode).toBe(500);
  });
});
