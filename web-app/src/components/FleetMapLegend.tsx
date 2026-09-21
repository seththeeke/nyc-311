import type { ReactElement } from "react";
import { ACTIVITY_COLOR, ACTIVITY_MEANING, ACTIVITY_ORDER } from "./fleetActivityStyle";

/* The same truck silhouette the map markers use (OperatorTrail.tsx), so the legend reads as a key to those icons. */
function TruckSwatch({ color }: { color: string }): ReactElement {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden="true" className="shrink-0">
      <path d="M2 7h12v8H2z" fill={color} stroke="#1f2937" strokeWidth={1} />
      <path d="M14 11h4l4 3v1h-8z" fill={color} stroke="#1f2937" strokeWidth={1} />
      <circle cx={6} cy={18} r={2} fill="#1f2937" />
      <circle cx={18} cy={18} r={2} fill="#1f2937" />
    </svg>
  );
}

/**
 * Small floating key for the fleet map: each truck in its marker colour and
 * what that colour means for status. Sits under Leaflet's +/- controls
 * (top-left, 10px inset, ~65px tall). Text carries the meaning; the colour
 * only ties it to the marker, so nothing here is colour-alone.
 */
export function FleetMapLegend(): ReactElement {
  return (
    <div
      role="group"
      aria-label="Fleet status legend"
      className="glass absolute top-[5.25rem] left-2.5 z-[1000] rounded-lg px-2.5 py-2"
    >
      <ul className="space-y-1">
        {ACTIVITY_ORDER.map((activity) => (
          <li key={activity} className="flex items-center gap-2 text-xs">
            <TruckSwatch color={ACTIVITY_COLOR[activity]} />
            <span className="font-medium text-fg">{ACTIVITY_MEANING[activity].label}</span>
            <span className="text-fg-subtle">{ACTIVITY_MEANING[activity].meaning}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
