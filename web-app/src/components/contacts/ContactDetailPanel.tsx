import type { ReactElement } from "react";
import { useCachedContact } from "../../hooks/useCachedContact";
import { useContactSelection } from "../../hooks/useContactSelection";
import { CONTACT_TYPE_LABELS, contactStatusText } from "./contactFormat";
import { CONTACT_STATUS_CLASSES } from "./contactStatusStyle";
import { ContactSubmitter } from "./ContactSubmitter";
import { ContactTimeline } from "./ContactTimeline";

/**
 * The Contacts page's secondary workspace: the contact picked from the
 * list, in full: who sent it, what they asked, where it stands and why.
 * Built from the loaded list, so it needs no API of its own.
 */
export function ContactDetailPanel(): ReactElement {
  const { contactId, selectContact } = useContactSelection();
  const contact = useCachedContact(contactId);
  if (!contactId) return <p className="px-4 text-sm text-fg-muted">Select a contact to see its details here.</p>;
  if (!contact) return <p className="px-4 text-sm text-fg-muted">This contact isn&apos;t in the loaded list. Find it there to open it.</p>;
  return (
    <section aria-label="Contact details" className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-line px-4 pb-2">
        <div>
          <h2 className="font-semibold text-fg">Contact</h2>
          <p className="text-xs text-fg-muted">{CONTACT_TYPE_LABELS[contact.contact_type]}</p>
        </div>
        <button type="button" onClick={() => selectContact(null)} aria-label="Close contact" className="rounded-lg px-2 py-1 text-fg-subtle hover:bg-panel-hover hover:text-fg">
          ×
        </button>
      </header>
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <ContactSubmitter name={contact.submitter_name} />
        <div>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CONTACT_STATUS_CLASSES[contact.status]}`}>{contactStatusText(contact.status, contact.closure_reason_code)}</span>
          <h3 className="mt-2 text-base font-semibold text-fg">{contact.title}</h3>
          <p className="mt-1 whitespace-pre-line text-sm text-fg-muted">{contact.description}</p>
        </div>
        {(contact.closure_reason_description || contact.ticket_number !== null) && (
          <div className="rounded-lg border border-line bg-panel p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">BoroughSim&apos;s response</h3>
            {contact.closure_reason_description && <p className="mt-1 text-sm text-fg">{contact.closure_reason_description}</p>}
            {contact.ticket_number !== null && <p className="mt-1 text-xs text-fg-muted">Ticket #{contact.ticket_number}</p>}
          </div>
        )}
        <ContactTimeline contact={contact} />
      </div>
    </section>
  );
}
