import type { ReactElement } from "react";

interface CapacityTileProps {
  /** Total active Operator count — `null` while still loading. */
  count: number | null;
}

/**
 * Static total-capacity overlay for the home-page fleet map — top-right,
 * just under the header, matching the loading/error pills' overlay style
 * (`HomePage.tsx`).
 */
export function CapacityTile({ count }: CapacityTileProps): ReactElement {
  return (
    <div
      role="status"
      aria-label={count === null ? "Total capacity: loading" : `Total capacity: ${count} operators`}
      className="pointer-events-none absolute top-4 right-4 z-[1000] flex h-20 w-20 flex-col items-center justify-center rounded-lg bg-slate-950/90 shadow-lg"
    >
      <span className="text-2xl font-semibold text-white">{count ?? "—"}</span>
      <span className="text-xs text-slate-400">Capacity</span>
    </div>
  );
}
