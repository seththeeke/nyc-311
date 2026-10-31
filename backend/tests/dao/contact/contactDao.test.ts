import { DynamoDBClient, TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContactDao } from "../../../dao/contact/contactDao";
import type { Contact } from "../../../models/contact";
import { TerminalError, ValidationError } from "../../../models/errors";

const ddbMock = mockClient(DynamoDBDocumentClient);
const TABLE = "Contacts-Test";

const contact: Contact = {
  contact_id: "01K8C4T1W7H3P9N2M6QZ8V0RJD",
  contact_type: "FEATURE_REQUEST",
  status: "RECEIVED",
  title: "Text me when a repair near me is scheduled",
  description: "Let me subscribe to a street and get a text when work is booked.",
  submitter: { name: "Hawthorn", email: null },
  closure_reason_code: null,
  closure_reason_description: null,
  client_request_id: "b6f0c1e2-7a4d-4c1e-9d55-2f0e8c3a9b11",
  created_at: "2026-11-02T22:14:02.000Z",
  updated_at: "2026-11-02T22:14:02.000Z",
};

function cancelled(codes: string[]): TransactionCanceledException {
  return new TransactionCanceledException({
    message: "cancelled",
    $metadata: {},
    CancellationReasons: codes.map((Code) => ({ Code })),
  });
}

function dao(): ContactDao {
  return new ContactDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), TABLE);
}

beforeEach(() => {
  ddbMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ContactDao.getContact", () => {
  it("reads one Contact by id", async () => {
    ddbMock.on(GetCommand).resolves({ Item: contact });
    await expect(dao().getContact(contact.contact_id)).resolves.toEqual(contact);
    expect(ddbMock.commandCalls(GetCommand)[0].args[0].input.Key).toEqual({ contact_id: contact.contact_id });
  });

  it("treats a pointer key as missing without reading", async () => {
    await expect(dao().getContact("CRID#abc")).resolves.toBeNull();
    expect(ddbMock.commandCalls(GetCommand)).toHaveLength(0);
  });
});

describe("ContactDao.createContact", () => {
  it("writes the Contact and its pointer in one conditional transaction", async () => {
    ddbMock.on(TransactWriteCommand).resolves({});
    await expect(dao().createContact(contact)).resolves.toEqual({ contact, replayed: false });
    const items = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems ?? [];
    expect(items).toHaveLength(2);
    expect(items[0].Put?.Item).toEqual(contact);
    expect(items[1].Put?.Item).toEqual({
      contact_id: `CRID#${contact.client_request_id}`,
      target_contact_id: contact.contact_id,
      created_at: contact.created_at,
    });
    for (const item of items) expect(item.Put?.ConditionExpression).toBe("attribute_not_exists(contact_id)");
  });

  it("writes no pointer when there is no client_request_id", async () => {
    ddbMock.on(TransactWriteCommand).resolves({});
    const noKey = { ...contact, client_request_id: null };
    await expect(dao().createContact(noKey)).resolves.toEqual({ contact: noKey, replayed: false });
    expect(ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems).toHaveLength(1);
  });

  it("returns the original Contact when the pointer is already taken", async () => {
    const original = { ...contact, contact_id: "01K8C4T1W7H3P9N2M6QZ8V0AAA" };
    ddbMock.on(TransactWriteCommand).rejects(cancelled(["None", "ConditionalCheckFailed"]));
    ddbMock
      .on(GetCommand, { Key: { contact_id: `CRID#${contact.client_request_id}` } })
      .resolves({ Item: { contact_id: `CRID#${contact.client_request_id}`, target_contact_id: original.contact_id, created_at: original.created_at } });
    ddbMock.on(GetCommand, { Key: { contact_id: original.contact_id } }).resolves({ Item: original });
    await expect(dao().createContact(contact)).resolves.toEqual({ contact: original, replayed: true });
  });

  it("fails when the pointer names no Contact", async () => {
    ddbMock.on(TransactWriteCommand).rejects(cancelled(["None", "ConditionalCheckFailed"]));
    ddbMock.on(GetCommand).resolves({});
    await expect(dao().createContact(contact)).rejects.toThrow(TerminalError);
  });

  it("rejects a malformed pointer row", async () => {
    ddbMock.on(TransactWriteCommand).rejects(cancelled(["None", "ConditionalCheckFailed"]));
    ddbMock.on(GetCommand).resolves({ Item: { contact_id: `CRID#${contact.client_request_id}` } });
    await expect(dao().createContact(contact)).rejects.toThrow(ValidationError);
  });

  it("wraps any other cancellation as TerminalError", async () => {
    ddbMock.on(TransactWriteCommand).rejects(cancelled(["ConditionalCheckFailed", "None"]));
    await expect(dao().createContact(contact)).rejects.toThrow(TerminalError);
  });

  it("wraps a cancellation without reasons as TerminalError", async () => {
    ddbMock.on(TransactWriteCommand).rejects(new TransactionCanceledException({ message: "cancelled", $metadata: {} }));
    await expect(dao().createContact(contact)).rejects.toThrow(TerminalError);
  });

  it("rethrows any other failure unchanged", async () => {
    ddbMock.on(TransactWriteCommand).rejects(new Error("network"));
    await expect(dao().createContact(contact)).rejects.toThrow("network");
  });

  it("rejects an invalid Contact before writing", async () => {
    await expect(dao().createContact({ ...contact, title: "" })).rejects.toThrow(ValidationError);
    expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(0);
  });
});
