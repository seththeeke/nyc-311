import type { ReactElement } from "react";
import type { Contact } from "../../models/contact";
import { contactDate, contactStatusText } from "./contactFormat";
import { CONTACT_STATUS_CLASSES } from "./contactStatusStyle";

interface ContactRowProps {
  contact: Contact;
  selected?: boolean;
  /* Opens the contact in the secondary workspace; without it the title is plain text. */
  onSelect?: (contactId: string) => void;
}

/** One contact: what was asked, who asked, and where it stands. A ticket number is plain text, never a link. */
export function ContactRow({ contact, selected = false, onSelect }: ContactRowProps): ReactElement {
  return (
    <li className={`rounded-lg border bg-panel p-4 ${selected ? "border-hue-indigo" : "border-line"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-fg">
          {onSelect ? (
            <button type="button" aria-pressed={selected} onClick={() => onSelect(contact.contact_id)} className="text-left hover:text-hue-blue hover:underline">
              {contact.title}
            </button>
          ) : (
            contact.title
          )}
        </h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CONTACT_STATUS_CLASSES[contact.status]}`}>{contactStatusText(contact.status, contact.closure_reason_code)}</span>
      </div>
      <p className="mt-1 text-sm text-fg-muted">{contact.description}</p>
      {contact.closure_reason_description && <p className="mt-2 text-sm text-fg">{contact.closure_reason_description}</p>}
      <p className="mt-2 text-xs text-fg-subtle">
        {contact.submitter_name} · {contactDate(contact.created_at)}
        {contact.ticket_number !== null && <> · Ticket #{contact.ticket_number}</>}
      </p>
    </li>
  );
}
