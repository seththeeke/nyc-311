import { useState, type ReactElement } from "react";
import type { ContactQuery } from "../../models/contact";
import { PAGE_CONTENT_CLASSES } from "../pageLayout";
import { ContactFilters } from "../residents/ContactFilters";
import { ContactList } from "../residents/ContactList";
import { ResidentsTabs } from "../residents/ResidentsTabs";

const DEFAULT_QUERY: ContactQuery = { type: "FEATURE_REQUEST", status: null, order: "NEWEST" };

/**
 * The Residents section's Contacts tab (docs/17-executive-team.md §17.3):
 * everything residents have sent BoroughSim, starting with feature
 * requests, and where each one stands. Public, behind CONTACTS_PAGE.
 */
export function ContactsPage(): ReactElement {
  const [query, setQuery] = useState<ContactQuery>(DEFAULT_QUERY);
  return (
    <main className={PAGE_CONTENT_CLASSES}>
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-fg">Residents</h1>
        <p className="mt-1 text-sm text-fg-muted">What residents have asked BoroughSim for, and where each request stands.</p>
      </header>
      <ResidentsTabs />
      <ContactFilters query={query} onChange={setQuery} />
      <ContactList query={query} />
    </main>
  );
}
