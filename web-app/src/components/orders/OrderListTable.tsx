import type { ReactElement } from "react";
import type { Order } from "../../models/order";

export interface OrderListTableProps {
  orders: Order[];
}

function formatCreatedAt(createdAt: string): string {
  return new Date(createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function StageBadge({ stage }: { stage: Order["current_stage"] }): ReactElement {
  return (
    <span className="inline-flex rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-medium text-cyan-800">
      {stage}
    </span>
  );
}

export function OrderListTable({ orders }: OrderListTableProps): ReactElement {
  return (
    <table className="mt-2 w-full border-collapse text-sm">
      <caption className="sr-only">Orders matching the current filters, one scanned page at a time</caption>
      <thead>
        <tr className="border-b border-slate-200 text-left text-slate-500">
          <th scope="col" className="py-2 pr-4 font-medium">Order</th>
          <th scope="col" className="py-2 pr-4 font-medium">Request</th>
          <th scope="col" className="py-2 pr-4 font-medium">Location</th>
          <th scope="col" className="py-2 pr-4 font-medium">Stage</th>
          <th scope="col" className="py-2 pr-4 font-medium">Status</th>
          <th scope="col" className="py-2 font-medium">Created</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <tr key={order.order_id} className="border-b border-slate-100">
            <td className="py-2 pr-4 font-mono text-xs text-slate-700">{order.order_id}</td>
            <td className="py-2 pr-4 font-mono text-xs text-slate-500">{order.request_id}</td>
            <td className="py-2 pr-4 text-slate-700">{order.location_id}</td>
            <td className="py-2 pr-4">
              <StageBadge stage={order.current_stage} />
            </td>
            <td className="py-2 pr-4 text-slate-700">{order.status}</td>
            <td className="py-2 text-slate-500">{formatCreatedAt(order.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
