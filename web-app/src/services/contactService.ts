import { config } from "../config";
import { ContactPageSchema, type ContactPage, type ContactQuery } from "../models/contact";
import { MOCK_CONTACTS } from "../test-data/contacts";

/* The Contacts list (docs/17-executive-team.md §17.3). */
export interface ContactService {
  listContacts(query: ContactQuery, cursor: string | null): Promise<ContactPage>;
}

export const CONTACT_PAGE_SIZE = 25;

class LiveContactService implements ContactService {
  async listContacts(query: ContactQuery, cursor: string | null): Promise<ContactPage> {
    const params = new URLSearchParams({ type: query.type, order: query.order, limit: String(CONTACT_PAGE_SIZE) });
    if (query.status) params.set("status", query.status);
    if (cursor) params.set("cursor", cursor);
    const response = await fetch(`${config.apiBaseUrl}/contacts?${params.toString()}`);
    if (!response.ok) throw new Error(`Failed to fetch contacts: HTTP ${response.status}`);
    return ContactPageSchema.parse(await response.json());
  }
}

/* Pages through the baked contacts two at a time, so the mock shows Load more too. */
class MockContactService implements ContactService {
  async listContacts(query: ContactQuery, cursor: string | null): Promise<ContactPage> {
    const matching = MOCK_CONTACTS.filter((c) => c.contact_type === query.type && (!query.status || c.status === query.status));
    const sorted = [...matching].sort((a, b) => (query.order === "NEWEST" ? b.created_at.localeCompare(a.created_at) : a.created_at.localeCompare(b.created_at)));
    const start = cursor ? Number(cursor) : 0;
    const end = start + 2;
    return { contacts: sorted.slice(start, end), next_cursor: end < sorted.length ? String(end) : null };
  }
}

export const contactService: ContactService =
  import.meta.env.VITE_DATA_MODE === "live" ? new LiveContactService() : new MockContactService();
