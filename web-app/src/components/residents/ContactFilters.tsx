import type { ReactElement } from "react";
import { CONTACT_LIST_ORDERS, CONTACT_STATUSES, CONTACT_TYPES, type ContactListOrder, type ContactQuery, type ContactStatus, type ContactType } from "../../models/contact";
import { CONTACT_ORDER_LABELS, CONTACT_STATUS_LABELS, CONTACT_TYPE_LABELS } from "./contactFormat";

interface ContactFiltersProps {
  query: ContactQuery;
  onChange: (query: ContactQuery) => void;
}

const SELECT_CLASSES = "rounded-md border border-line bg-panel px-2 py-1.5 text-sm text-fg";
const ALL = "ALL";

/** Type, status and sort for the Contacts list. */
export function ContactFilters({ query, onChange }: ContactFiltersProps): ReactElement {
  return (
    <div className="mb-4 flex flex-wrap gap-3">
      <label className="flex items-center gap-2 text-sm text-fg-muted">
        Type
        <select className={SELECT_CLASSES} value={query.type} onChange={(e) => onChange({ ...query, type: e.target.value as ContactType })}>
          {CONTACT_TYPES.map((type) => (
            <option key={type} value={type}>
              {CONTACT_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-fg-muted">
        Status
        <select
          className={SELECT_CLASSES}
          value={query.status ?? ALL}
          onChange={(e) => onChange({ ...query, status: e.target.value === ALL ? null : (e.target.value as ContactStatus) })}
        >
          <option value={ALL}>All</option>
          {CONTACT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {CONTACT_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-fg-muted">
        Sort
        <select className={SELECT_CLASSES} value={query.order} onChange={(e) => onChange({ ...query, order: e.target.value as ContactListOrder })}>
          {CONTACT_LIST_ORDERS.map((order) => (
            <option key={order} value={order}>
              {CONTACT_ORDER_LABELS[order]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
