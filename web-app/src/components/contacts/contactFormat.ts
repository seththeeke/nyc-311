import type { ContactListOrder, ContactStatus, ContactType } from "../../models/contact";

/* Display names for the Contacts page (docs/17-executive-team.md §17.3). */

export const CONTACT_TYPE_LABELS: Readonly<Record<ContactType, string>> = { FEATURE_REQUEST: "Feature requests" };

export const CONTACT_STATUS_LABELS: Readonly<Record<ContactStatus, string>> = {
  RECEIVED: "Received",
  IN_PROGRESS: "In progress",
  CLOSED: "Closed",
};

export const CONTACT_ORDER_LABELS: Readonly<Record<ContactListOrder, string>> = { NEWEST: "Newest first", OLDEST: "Oldest first" };

const CLOSURE_REASON_LABELS: Readonly<Record<string, string>> = { DUPLICATE: "Duplicate", DECLINED: "Declined", SHIPPED: "Shipped" };

/** "Closed · Duplicate", or just the status. */
export function contactStatusText(status: ContactStatus, closureReasonCode: string | null): string {
  const reason = closureReasonCode ? (CLOSURE_REASON_LABELS[closureReasonCode] ?? closureReasonCode) : null;
  return reason ? `${CONTACT_STATUS_LABELS[status]} · ${reason}` : CONTACT_STATUS_LABELS[status];
}

/** "Nov 4, 2026". */
export function contactDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });
}
