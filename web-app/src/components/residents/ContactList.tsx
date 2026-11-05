import type { ReactElement } from "react";
import { useContacts } from "../../hooks/useContacts";
import type { ContactQuery } from "../../models/contact";
import { ContactRow } from "./ContactRow";

/** The contacts matching the filters, a page at a time. */
export function ContactList({ query }: { query: ContactQuery }): ReactElement {
  const { data, status, error, hasNextPage, fetchNextPage, isFetchingNextPage } = useContacts(query);
  if (status === "pending") {
    return (
      <p role="status" className="text-sm text-fg-muted">
        Loading contacts…
      </p>
    );
  }
  if (status === "error") {
    return (
      <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
        Couldn't load contacts: {error.message}
      </p>
    );
  }
  const contacts = data.pages.flatMap((page) => page.contacts);
  return (
    <div className="space-y-3">
      {contacts.length === 0 && <p className="text-sm text-fg-muted">No contacts match these filters yet.</p>}
      <ul className="space-y-3">
        {contacts.map((contact) => (
          <ContactRow key={contact.contact_id} contact={contact} />
        ))}
      </ul>
      {hasNextPage && (
        <button
          type="button"
          onClick={() => void fetchNextPage()}
          disabled={isFetchingNextPage}
          className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-fg-muted hover:bg-panel-hover hover:text-fg disabled:opacity-60"
        >
          Load more
        </button>
      )}
    </div>
  );
}
