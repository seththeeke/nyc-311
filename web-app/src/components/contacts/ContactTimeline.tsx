import type { ReactElement } from "react";
import type { Contact } from "../../models/contact";
import { CONTACT_STATUS_LABELS, contactDate } from "./contactFormat";

interface TimelineStep {
  label: string;
  date: string | null;
  state: "DONE" | "CURRENT" | "UPCOMING";
}

/*
 * A contact stores only when it arrived and when it last changed, so only
 * those two moments get a date. A closed contact may never have been in
 * progress (a duplicate), so Closed follows Received directly.
 */
export function contactTimeline(contact: Contact): TimelineStep[] {
  const received: TimelineStep = { label: CONTACT_STATUS_LABELS.RECEIVED, date: contact.created_at, state: contact.status === "RECEIVED" ? "CURRENT" : "DONE" };
  if (contact.status === "RECEIVED") {
    return [received, { label: CONTACT_STATUS_LABELS.IN_PROGRESS, date: null, state: "UPCOMING" }, { label: CONTACT_STATUS_LABELS.CLOSED, date: null, state: "UPCOMING" }];
  }
  if (contact.status === "IN_PROGRESS") {
    return [received, { label: CONTACT_STATUS_LABELS.IN_PROGRESS, date: contact.updated_at, state: "CURRENT" }, { label: CONTACT_STATUS_LABELS.CLOSED, date: null, state: "UPCOMING" }];
  }
  return [received, { label: CONTACT_STATUS_LABELS.CLOSED, date: contact.updated_at, state: "CURRENT" }];
}

const DOT_CLASSES: Readonly<Record<TimelineStep["state"], string>> = {
  DONE: "border-hue-indigo bg-hue-indigo",
  CURRENT: "border-hue-indigo bg-panel ring-2 ring-hue-indigo/30",
  UPCOMING: "border-line bg-panel",
};

/** Where a contact has been: Received, then In progress, then Closed. */
export function ContactTimeline({ contact }: { contact: Contact }): ReactElement {
  return (
    <ol aria-label="Status history" className="space-y-3">
      {contactTimeline(contact).map((step) => (
        <li key={step.label} aria-current={step.state === "CURRENT" ? "step" : undefined} className="flex items-start gap-3">
          <span aria-hidden="true" className={`mt-1 h-3 w-3 shrink-0 rounded-full border-2 ${DOT_CLASSES[step.state]}`} />
          <div>
            <p className={`text-sm ${step.state === "UPCOMING" ? "text-fg-subtle" : "font-medium text-fg"}`}>{step.label}</p>
            {step.date && <p className="text-xs text-fg-muted">{contactDate(step.date)}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
