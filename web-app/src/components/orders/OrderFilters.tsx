import type { ChangeEvent, ReactElement } from "react";
import { ORDER_STAGES, ORDER_STATUSES, type OrderStage, type OrderStatus } from "../../models/order";

export interface OrderFiltersProps {
  stage: OrderStage | "";
  status: OrderStatus | "";
  onStageChange: (stage: OrderStage | "") => void;
  onStatusChange: (status: OrderStatus | "") => void;
}

const SELECT_CLASSES =
  "rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 focus:border-cyan-400/50 focus:outline-none";

/** Proves `GET /orders`'s stage/status filtering is actually wired up, not just paginating an unfiltered scan. */
export function OrderFilters({ stage, status, onStageChange, onStatusChange }: OrderFiltersProps): ReactElement {
  function handleStageChange(event: ChangeEvent<HTMLSelectElement>): void {
    onStageChange(event.target.value as OrderStage | "");
  }

  function handleStatusChange(event: ChangeEvent<HTMLSelectElement>): void {
    onStatusChange(event.target.value as OrderStatus | "");
  }

  return (
    <div className="flex flex-wrap gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="order-stage-filter" className="text-xs font-medium text-slate-400">
          Stage
        </label>
        <select id="order-stage-filter" value={stage} onChange={handleStageChange} className={SELECT_CLASSES}>
          <option value="">All stages</option>
          {ORDER_STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="order-status-filter" className="text-xs font-medium text-slate-400">
          Status
        </label>
        <select id="order-status-filter" value={status} onChange={handleStatusChange} className={SELECT_CLASSES}>
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
