import { ulid } from "ulid";
import { logInfo } from "../../logger";
import { requireEnv } from "../../env";
import { createDocumentClient } from "../../dynamoClient";
import { ContactDao } from "../../dao/contact/contactDao";
import type { Contact, CreateContactInput } from "../../models/contact";
import type { ContactListItem, ContactListPage, ListContactsQuery } from "../../models/contactList";
import { NotFoundError } from "../../models/errors";

/* Lazily constructed per CLAUDE.md §5.2 — never a module-scope singleton. */
function getContactDao(): ContactDao {
  return new ContactDao(createDocumentClient(), requireEnv("CONTACTS_TABLE_NAME"));
}

export interface ContactServiceDeps {
  contactDao?: ContactDao;
  now?: () => Date;
  newId?: () => string;
}

/**
 * Creates a Contact in `RECEIVED` (16-resident-action-models.md §3.2). A
 * repeated `client_request_id` returns the original Contact instead of a
 * second one.
 */
export async function createContact(input: CreateContactInput, deps: ContactServiceDeps = {}): Promise<Contact> {
  const contactDao = deps.contactDao ?? getContactDao();
  const now = (deps.now ?? (() => new Date()))().toISOString();
  const contact: Contact = {
    contact_id: (deps.newId ?? ulid)(),
    contact_type: input.contact_type,
    status: "RECEIVED",
    title: input.title,
    description: input.description,
    submitter: input.submitter,
    closure_reason_code: null,
    closure_reason_description: null,
    client_request_id: input.client_request_id,
    created_at: now,
    updated_at: now,
  };
  logInfo("ContactCreating", {
    contactId: contact.contact_id,
    contactType: contact.contact_type,
    hasClientRequestId: contact.client_request_id !== null,
  });
  const { contact: stored, replayed } = await contactDao.createContact(contact);
  logInfo(replayed ? "ContactCreateReplayed" : "ContactCreated", { contactId: stored.contact_id, status: stored.status });
  return stored;
}

/** @throws {@link NotFoundError} if no Contact has that id. */
export async function getContact(contactId: string, deps: ContactServiceDeps = {}): Promise<Contact> {
  const contactDao = deps.contactDao ?? getContactDao();
  const contact = await contactDao.getContact(contactId);
  if (!contact) {
    logInfo("ContactNotFound", { contactId });
    throw new NotFoundError(`No contact ${contactId}`);
  }
  logInfo("ContactFetched", { contactId, status: contact.status });
  return contact;
}

/** The public view of a Contact: the submitter's name only, never an email or idempotency key. */
export function toContactListItem(contact: Contact): ContactListItem {
  return {
    contact_id: contact.contact_id,
    contact_type: contact.contact_type,
    status: contact.status,
    title: contact.title,
    description: contact.description,
    submitter_name: contact.submitter.name,
    closure_reason_code: contact.closure_reason_code,
    closure_reason_description: contact.closure_reason_description,
    ticket_number: contact.ticket_number ?? null,
    created_at: contact.created_at,
    updated_at: contact.updated_at,
  };
}

/** One page of Contacts for the public list (17-executive-team.md §17.3). */
export async function listContacts(query: ListContactsQuery, deps: ContactServiceDeps = {}): Promise<ContactListPage> {
  const contactDao = deps.contactDao ?? getContactDao();
  const page = await contactDao.listContacts({ contactType: query.type, status: query.status, order: query.order, limit: query.limit, cursor: query.cursor });
  logInfo("ContactsListed", { type: query.type, status: query.status ?? null, order: query.order, count: page.contacts.length, hasMore: page.nextCursor !== null });
  return { contacts: page.contacts.map(toContactListItem), next_cursor: page.nextCursor };
}
