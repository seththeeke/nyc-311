import type { ReactElement } from "react";
import type { CapacityStatus } from "../../models/operator";

interface CapacityStatsPanelProps {
  status: CapacityStatus;
}

interface StatTile {
  label: string;
  value: string;
}

/** Live fleet stats — a direct query against current projections, not folded event history (§2.3). */
export function CapacityStatsPanel({ status }: CapacityStatsPanelProps): ReactElement {
  const tiles: StatTile[] = [
    { label: "Available now", value: String(status.available_count) },
    { label: "Fleet size", value: String(status.fleet_size) },
    { label: "Hourly burn rate", value: `$${status.hourly_burn_rate.toFixed(2)}/hr` },
  ];

  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
          <dt className="text-sm text-slate-400">{tile.label}</dt>
          <dd className="mt-1 text-3xl font-semibold text-white">{tile.value}</dd>
        </div>
      ))}
    </dl>
  );
}
