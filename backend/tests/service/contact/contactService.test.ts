import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContactDao } from "../../../dao/contact/contactDao";
import type { Contact, CreateContactInput } from "../../../models/contact";
import { NotFoundError, ValidationError } from "../../../models/errors";
import { createContact, getContact, listContacts, updateContact } from "../../../service/contact/contactService";

const input: CreateContactInput = {
  contact_type: "FEATURE_REQUEST",
  title: "Text me when a repair near me is scheduled",
  description: "Let me subscribe to a street and get a text when work is booked.",
  submitter: { name: "Hawthorn", email: null },
  client_request_id: "b6f0c1e2-7a4d-4c1e-9d55-2f0e8c3a9b11",
};

const NOW = new Date("2026-11-02T22:14:02.000Z");
const ID = "01K8C4T1W7H3P9N2M6QZ8V0RJD";

const expected: Contact = {
  contact_id: ID,
  ...input,
  status: "RECEIVED",
  closure_reason_code: null,
  closure_reason_description: null,
  created_at: NOW.toISOString(),
  updated_at: NOW.toISOString(),
};

const ddbMock = mockClient(DynamoDBDocumentClient);

beforeEach(() => {
  ddbMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createContact", () => {
  it("creates a RECEIVED Contact with a new id and timestamps", async () => {
    const contactDao = { createContact: vi.fn().mockResolvedValue({ contact: expected, replayed: false }) } as unknown as ContactDao;
    await expect(createContact(input, { contactDao, now: () => NOW, newId: () => ID })).resolves.toEqual(expected);
    expect(contactDao.createContact).toHaveBeenCalledWith(expected);
  });

  it("returns the original Contact on a replayed client_request_id", async () => {
    const original = { ...expected, contact_id: "01K8C4T1W7H3P9N2M6QZ8V0AAA" };
    const contactDao = { createContact: vi.fn().mockResolvedValue({ contact: original, replayed: true }) } as unknown as ContactDao;
    await expect(createContact(input, { contactDao })).resolves.toEqual(original);
  });
});

describe("getContact", () => {
  it("returns the Contact", async () => {
    const contactDao = { getContact: vi.fn().mockResolvedValue(expected) } as unknown as ContactDao;
    await expect(getContact(ID, { contactDao })).resolves.toEqual(expected);
  });

  it("throws NotFoundError when missing", async () => {
    const contactDao = { getContact: vi.fn().mockResolvedValue(null) } as unknown as ContactDao;
    await expect(getContact(ID, { contactDao })).rejects.toThrow(NotFoundError);
  });

  it("builds its own DAO from CONTACTS_TABLE_NAME when none is given", async () => {
    ddbMock.on(GetCommand).resolves({ Item: expected });
    await expect(getContact(ID)).resolves.toEqual(expected);
    expect(ddbMock.commandCalls(GetCommand)[0].args[0].input.TableName).toBe("Contacts");
  });
});

describe("listContacts", () => {
  it("maps each Contact to its public row, without the email or idempotency key", async () => {
    const stored: Contact = { ...expected, submitter: { name: "Hawthorn", email: "h@example.com" }, ticket_number: 42 };
    const listMock = vi.fn().mockResolvedValue({ contacts: [stored, expected], nextCursor: "next" });
    const page = await listContacts({ type: "FEATURE_REQUEST", order: "NEWEST", limit: 25 }, { contactDao: { listContacts: listMock } as unknown as ContactDao });
    expect(listMock).toHaveBeenCalledWith({ contactType: "FEATURE_REQUEST", status: undefined, order: "NEWEST", limit: 25, cursor: undefined });
    expect(page.next_cursor).toBe("next");
    expect(page.contacts[0]).toEqual({
      contact_id: ID,
      contact_type: "FEATURE_REQUEST",
      status: "RECEIVED",
      title: input.title,
      description: input.description,
      submitter_name: "Hawthorn",
      closure_reason_code: null,
      closure_reason_description: null,
      ticket_number: 42,
      created_at: NOW.toISOString(),
      updated_at: NOW.toISOString(),
    });
    expect(page.contacts[1].ticket_number).toBeNull();
    expect(JSON.stringify(page)).not.toContain("h@example.com");
  });
});

describe("updateContact", () => {
  const later = () => new Date("2026-11-05T14:00:00.000Z");
  function daoWith(current: Contact | null) {
    const replaceContact = vi.fn(async (c: Contact) => c);
    return { replaceContact, contactDao: { getContact: vi.fn().mockResolvedValue(current), replaceContact } as unknown as ContactDao };
  }

  it("moves a RECEIVED contact to IN_PROGRESS with its ticket, conditioned on the version read", async () => {
    const { replaceContact, contactDao } = daoWith(expected);
    const stored = await updateContact(ID, { status: "IN_PROGRESS", ticket_number: 170, status_reason_description: "Tracked as ticket #170." }, "cpo", { contactDao, now: later });
    expect(stored).toMatchObject({ status: "IN_PROGRESS", ticket_number: 170, closure_reason_code: null, closure_reason_description: "Tracked as ticket #170.", updated_at: later().toISOString() });
    expect(replaceContact).toHaveBeenCalledWith(stored, expected.updated_at);
  });

  it("closes a contact with a reason, keeping its ticket when none is given", async () => {
    const { contactDao } = daoWith({ ...expected, status: "IN_PROGRESS", ticket_number: 170 });
    const stored = await updateContact(ID, { status: "CLOSED", closure_reason_code: "SHIPPED", status_reason_description: "Shipped.", ticket_number: null }, "cpo", { contactDao, now: later });
    expect(stored).toMatchObject({ status: "CLOSED", closure_reason_code: "SHIPPED", ticket_number: 170 });
    const fresh = daoWith(expected);
    expect((await updateContact(ID, { status: "CLOSED", closure_reason_code: "DECLINED", status_reason_description: "No.", ticket_number: null }, "cpo", { contactDao: fresh.contactDao })).ticket_number).toBeNull();
  });

  it("refuses a closed or missing contact", async () => {
    await expect(updateContact(ID, { status: "IN_PROGRESS", ticket_number: 1, status_reason_description: "x" }, "cpo", { contactDao: daoWith({ ...expected, status: "CLOSED" }).contactDao })).rejects.toThrow(ValidationError);
    await expect(updateContact(ID, { status: "IN_PROGRESS", ticket_number: 1, status_reason_description: "x" }, "cpo", { contactDao: daoWith(null).contactDao })).rejects.toThrow(NotFoundError);
  });
});
