import type { ChangeEvent, ReactElement } from "react";
import { ORDER_EVENT_TYPES, type OrderEventType } from "../../models/order";

export interface OrderEventFiltersProps {
  eventType: OrderEventType | "";
  orderId: string;
  onEventTypeChange: (eventType: OrderEventType | "") => void;
  onOrderIdChange: (orderId: string) => void;
}

const SELECT_CLASSES =
  "rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 focus:border-cyan-400/50 focus:outline-none";

const INPUT_CLASSES = SELECT_CLASSES;

/** Proves `GET /order-events`'s event_type/order_id filtering is actually wired up, not just paginating an unfiltered scan. */
export function OrderEventFilters({
  eventType,
  orderId,
  onEventTypeChange,
  onOrderIdChange,
}: OrderEventFiltersProps): ReactElement {
  function handleEventTypeChange(event: ChangeEvent<HTMLSelectElement>): void {
    onEventTypeChange(event.target.value as OrderEventType | "");
  }

  function handleOrderIdChange(event: ChangeEvent<HTMLInputElement>): void {
    onOrderIdChange(event.target.value);
  }

  return (
    <div className="flex flex-wrap gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="order-event-type-filter" className="text-xs font-medium text-slate-400">
          Event type
        </label>
        <select
          id="order-event-type-filter"
          value={eventType}
          onChange={handleEventTypeChange}
          className={SELECT_CLASSES}
        >
          <option value="">All event types</option>
          {ORDER_EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="order-event-order-id-filter" className="text-xs font-medium text-slate-400">
          Order ID
        </label>
        <input
          id="order-event-order-id-filter"
          type="text"
          value={orderId}
          onChange={handleOrderIdChange}
          placeholder="Filter by order_id"
          className={INPUT_CLASSES}
        />
      </div>
    </div>
  );
}
