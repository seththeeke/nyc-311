import type { ReactElement } from "react";
import type { Contact } from "../../models/contact";
import { contactDate, contactStatusText } from "./contactFormat";

const STATUS_CLASSES: Readonly<Record<Contact["status"], string>> = {
  RECEIVED: "bg-panel-strong text-fg-muted",
  IN_PROGRESS: "bg-panel-strong text-hue-indigo",
  CLOSED: "bg-panel-strong text-fg-subtle",
};

/** One contact: what was asked, who asked, and where it stands. A ticket number is plain text, never a link. */
export function ContactRow({ contact }: { contact: Contact }): ReactElement {
  return (
    <li className="rounded-lg border border-line bg-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-fg">{contact.title}</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[contact.status]}`}>{contactStatusText(contact.status, contact.closure_reason_code)}</span>
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
