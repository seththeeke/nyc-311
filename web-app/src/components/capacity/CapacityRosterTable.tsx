import type { ReactElement } from "react";
import type { Operator } from "../../models/operator";

interface CapacityRosterTableProps {
  roster: Operator[];
  onRemove: (operatorId: string) => void;
  removingOperatorId: string | null;
}

/** The active fleet roster (`GET /capacity`'s roster, ACTIVE Operators only) with a per-row remove action. */
export function CapacityRosterTable({ roster, onRemove, removingOperatorId }: CapacityRosterTableProps): ReactElement {
  if (roster.length === 0) {
    return <p className="text-sm text-slate-400">No active vehicles.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="min-w-full divide-y divide-white/10 text-left text-sm">
        <thead className="bg-white/[0.04] text-slate-400">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">
              Operator
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Activity
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Rate
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Since
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {roster.map((operator) => (
            <tr key={operator.operator_id}>
              <td className="px-4 py-3 font-mono text-xs text-slate-300">{operator.operator_id}</td>
              <td className="px-4 py-3 text-slate-300">
                {operator.current_activity}
                {operator.removal_requested_at && <span className="ml-2 text-amber-400">(removal queued)</span>}
              </td>
              <td className="px-4 py-3 text-slate-300">${operator.rate_per_hour.toFixed(2)}/hr</td>
              <td className="px-4 py-3 text-slate-300">{new Date(operator.start_datetime).toLocaleString()}</td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => onRemove(operator.operator_id)}
                  disabled={removingOperatorId === operator.operator_id || Boolean(operator.removal_requested_at)}
                  className="rounded bg-rose-600/80 px-3 py-1 text-white disabled:opacity-50"
                  aria-label={`Remove vehicle ${operator.operator_id}`}
                >
                  {removingOperatorId === operator.operator_id ? "Removing…" : "Remove"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
