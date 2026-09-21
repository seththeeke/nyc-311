import type { ReactElement } from "react";
import type { Share } from "./chartShares";

/** Swatch + name + percent per share. The text carries the value, so the colour never has to be decoded alone. */
export function ShareLegend({ shares }: { shares: readonly Share[] }): ReactElement {
  return (
    <ul className="min-w-0 space-y-1">
      {shares.map((share) => (
        <li key={share.label} className="flex items-center gap-1.5 text-[11px]">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: share.color }} />
          <span className="truncate text-fg-muted">{share.label}</span>
          <span className="ml-auto font-medium text-fg">{Math.round(share.percent)}%</span>
        </li>
      ))}
    </ul>
  );
}
