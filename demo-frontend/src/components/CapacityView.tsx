import { useOperators, useShifts } from "../lib/queries";
import { agencyColor, activityLabel } from "../lib/theme";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

const ACTIVITY_DOT: Record<string, string> = {
  idle: "#898781",
  transit: "#eda100",
  working: "#0ca30c",
  off_shift: "#c3c2b7",
};

export function CapacityView() {
  const { data: shifts, isLoading: shiftsLoading } = useShifts();
  const { data: operators, isLoading: opsLoading } = useOperators();

  if (shiftsLoading || opsLoading || !shifts || !operators) {
    return <div className="text-sm text-[var(--color-ink-muted)]">Loading capacity data&hellip;</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-[var(--color-ink)]">Shifts by Pool</h3>
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-paper)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
              <tr>
                <th className="px-3 py-2">Pool</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Window</th>
                <th className="px-3 py-2">Rate</th>
                <th className="px-3 py-2">Units</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => {
                const units = operators.filter((o) => o.current_shift_id === s.shift_id);
                const [agency] = s.pool.split("#");
                return (
                  <tr key={s.shift_id} className="border-t border-[var(--color-border-soft)]">
                    <td className="px-3 py-2">
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: agencyColor(agency) }} />
                      {s.pool.replace("#", " – ")}
                    </td>
                    <td className="px-3 py-2 capitalize">{s.status}</td>
                    <td className="px-3 py-2 text-xs text-[var(--color-ink-soft)]">
                      {fmtTime(s.scheduled_start)} &ndash; {fmtTime(s.scheduled_end)}
                    </td>
                    <td className="px-3 py-2 text-xs tabular-nums">${s.rate_per_hour}/hr</td>
                    <td className="px-3 py-2 text-xs">{units.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-[var(--color-ink)]">Operator Roster</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {operators.map((op) => (
            <div key={op.operator_id} className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
              <div>
                <div className="text-sm font-medium text-[var(--color-ink)]">{op._display_name}</div>
                <div className="text-xs text-[var(--color-ink-muted)]">{op.function_type}</div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[var(--color-ink-soft)]">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: ACTIVITY_DOT[op.current_activity] }} />
                {activityLabel(op.current_activity)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
