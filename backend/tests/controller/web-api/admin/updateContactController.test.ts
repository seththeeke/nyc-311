import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateContactController } from "../../../../controller/web-api/admin/updateContactController";
import type { Contact } from "../../../../models/contact";
import { ConflictError, NotFoundError, ValidationError } from "../../../../models/errors";
import { toContactListItem, updateContact } from "../../../../service/contact/contactService";

vi.mock("../../../../service/contact/contactService", () => ({ updateContact: vi.fn(), toContactListItem: vi.fn((c: Contact) => ({ contact_id: c.contact_id, status: c.status })) }));
const mockedUpdate = vi.mocked(updateContact);

const contact = { contact_id: "C1", status: "IN_PROGRESS" } as Contact;

function event(body: unknown, contactId: string | null = "C1"): unknown {
  return {
    rawPath: "/admin/contacts/C1",
    requestContext: { http: { method: "PATCH" }, authorizer: { jwt: { claims: { email: "cpo-agent@agents.boroughsim.com" } } } },
    pathParameters: contactId ? { contact_id: contactId } : {},
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
}

const inProgress = { status: "IN_PROGRESS", ticket_number: 170, status_reason_description: "We're tracking this as ticket #170." };

beforeEach(() => {
  mockedUpdate.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("updateContactController", () => {
  it("updates the contact as the caller and returns its public row", async () => {
    mockedUpdate.mockResolvedValue(contact);
    const response = await updateContactController(event(inProgress));
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body as string)).toEqual({ contact_id: "C1", status: "IN_PROGRESS" });
    expect(mockedUpdate).toHaveBeenCalledWith("C1", inProgress, "cpo-agent@agents.boroughsim.com");
    expect(toContactListItem).toHaveBeenCalledWith(contact);
  });

  it("defaults a CLOSED ticket number to null and names an unknown caller", async () => {
    mockedUpdate.mockResolvedValue(contact);
    const closed = { status: "CLOSED", closure_reason_code: "DUPLICATE", status_reason_description: "Same as ticket #170." };
    const noClaims = { ...(event(closed) as Record<string, unknown>), requestContext: { http: { method: "PATCH" } } };
    expect((await updateContactController(noClaims)).statusCode).toBe(200);
    expect(mockedUpdate).toHaveBeenCalledWith("C1", { ...closed, ticket_number: null }, "unknown");
  });

  it("returns 400 for a bad event, path, JSON or body", async () => {
    expect((await updateContactController({})).statusCode).toBe(400);
    expect((await updateContactController(event(inProgress, null))).statusCode).toBe(400);
    expect((await updateContactController(event("{nope"))).statusCode).toBe(400);
    expect((await updateContactController({ ...(event(inProgress) as Record<string, unknown>), body: null })).statusCode).toBe(400);
    expect((await updateContactController(event({ status: "IN_PROGRESS", status_reason_description: "x" }))).statusCode).toBe(400);
    expect((await updateContactController(event({ status: "CLOSED", closure_reason_code: "LATER", status_reason_description: "x" }))).statusCode).toBe(400);
    expect((await updateContactController(event({ status: "RECEIVED" }))).statusCode).toBe(400);
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it.each([
    [new NotFoundError("No contact C1"), 404],
    [new ValidationError("already closed"), 400],
    [new ConflictError("changed"), 409],
    [new Error("boom"), 500],
    ["boom", 500],
  ])("maps %s to %i", async (err, status) => {
    mockedUpdate.mockRejectedValue(err);
    expect((await updateContactController(event(inProgress))).statusCode).toBe(status);
  });
});
