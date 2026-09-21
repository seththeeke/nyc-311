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
    return <p className="text-sm text-fg-subtle">No active vehicles.</p>;
  }

  return (
    <div className="glass overflow-x-auto rounded-xl">
      <table className="min-w-full divide-y divide-line text-left text-sm">
        <thead className="bg-panel text-fg-subtle">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">
              Name
            </th>
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
        <tbody className="divide-y divide-line-soft">
          {roster.map((operator) => (
            <tr key={operator.operator_id}>
              <td className="px-4 py-3 text-fg">{operator.name}</td>
              <td className="px-4 py-3 font-mono text-xs text-fg-muted">{operator.operator_id}</td>
              <td className="px-4 py-3 text-fg-muted">
                {operator.current_activity}
                {operator.removal_requested_at && <span className="ml-2 text-hue-amber">(removal queued)</span>}
              </td>
              <td className="px-4 py-3 text-fg-muted">${operator.rate_per_hour.toFixed(2)}/hr</td>
              <td className="px-4 py-3 text-fg-muted">{new Date(operator.start_datetime).toLocaleString()}</td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => onRemove(operator.operator_id)}
                  disabled={removingOperatorId === operator.operator_id || Boolean(operator.removal_requested_at)}
                  className="rounded bg-rose-600/80 px-3 py-1 text-fg disabled:opacity-50"
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
