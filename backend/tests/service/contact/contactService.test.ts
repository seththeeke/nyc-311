import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContactDao } from "../../../dao/contact/contactDao";
import type { Contact, CreateContactInput } from "../../../models/contact";
import { NotFoundError } from "../../../models/errors";
import { createContact, getContact } from "../../../service/contact/contactService";

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
