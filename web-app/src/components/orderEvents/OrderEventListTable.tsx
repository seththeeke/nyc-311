import type { ReactElement } from "react";
import type { OrderEvent } from "../../models/order";

export interface OrderEventListTableProps {
  events: OrderEvent[];
}

function formatOccurredAt(occurredAt: string): string {
  return new Date(occurredAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const EVENT_TYPE_BADGE_CLASSES: Record<string, string> = {
  ORDER_ACCEPTED: "bg-emerald-100 text-emerald-800",
  ORDER_REJECTED: "bg-rose-100 text-rose-800",
  CASE_CREATED: "bg-amber-100 text-amber-800",
};
const DEFAULT_BADGE_CLASSES = "bg-cyan-100 text-cyan-800";

function EventTypeBadge({ eventType }: { eventType: OrderEvent["event_type"] }): ReactElement {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${EVENT_TYPE_BADGE_CLASSES[eventType] ?? DEFAULT_BADGE_CLASSES}`}
    >
      {eventType}
    </span>
  );
}

export function OrderEventListTable({ events }: OrderEventListTableProps): ReactElement {
  return (
    <table className="mt-2 w-full border-collapse text-sm">
      <caption className="sr-only">OrderEvents matching the current filters, one scanned page at a time</caption>
      <thead>
        <tr className="border-b border-slate-200 text-left text-slate-500">
          <th scope="col" className="py-2 pr-4 font-medium">Order</th>
          <th scope="col" className="py-2 pr-4 font-medium">Seq</th>
          <th scope="col" className="py-2 pr-4 font-medium">Event type</th>
          <th scope="col" className="py-2 pr-4 font-medium">Actor</th>
          <th scope="col" className="py-2 font-medium">Occurred</th>
        </tr>
      </thead>
      <tbody>
        {events.map((event) => (
          <tr key={`${event.order_id}-${event.sequence_number}`} className="border-b border-slate-100">
            <td className="py-2 pr-4 font-mono text-xs text-slate-700">{event.order_id}</td>
            <td className="py-2 pr-4 text-slate-500">{event.sequence_number}</td>
            <td className="py-2 pr-4">
              <EventTypeBadge eventType={event.event_type} />
            </td>
            <td className="py-2 pr-4 text-slate-700">{event.actor}</td>
            <td className="py-2 text-slate-500">{formatOccurredAt(event.occurred_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
