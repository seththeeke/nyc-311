import { type ReactElement, useState } from "react";
import type { FleetOperatorLocation } from "../../models/fleetLocation";
import { ACTIVITY_COLOR, ACTIVITY_MEANING } from "../fleetActivityStyle";
import { GLASS } from "./hudStyle";
import { MapV2Glyph } from "./MapV2Glyph";

interface FleetRosterProps {
  operators: FleetOperatorLocation[];
  selectedId: string | null;
  onSelect: (operatorId: string | null) => void;
}

/**
 * Every vehicle as a button — the keyboard path to everything a click on
 * the map does. Vehicles with no GPS fix are listed but can't be focused.
 */
export function FleetRoster({ operators, selectedId, onSelect }: FleetRosterProps): ReactElement {
  const [open, setOpen] = useState(true);
  return (
    <section aria-label="Fleet roster" className={`${GLASS} absolute top-16 right-4 z-10 flex max-h-[22%] w-36 flex-col overflow-hidden`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between px-3 py-2 text-[10px] font-semibold tracking-[0.14em] text-fg-muted uppercase hover:text-fg focus-visible:ring-2 focus-visible:ring-hue-cyan focus-visible:outline-none"
      >
        Roster · {operators.length}
        <MapV2Glyph name={open ? "MINUS" : "PLUS"} className="h-3 w-3" />
      </button>
      {open && (
        <ul className="overflow-y-auto px-1.5 pb-1.5">
          {operators.map((operator) => {
            const plotted = operator.current_location !== null;
            const selected = operator.operator_id === selectedId;
            return (
              <li key={operator.operator_id}>
                <button
                  type="button"
                  disabled={!plotted}
                  aria-pressed={selected}
                  onClick={() => onSelect(selected ? null : operator.operator_id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition focus-visible:ring-2 focus-visible:ring-hue-cyan focus-visible:outline-none disabled:opacity-50 ${selected ? "bg-panel-strong" : "hover:bg-panel-hover"}`}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: ACTIVITY_COLOR[operator.current_activity] }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-fg">{operator.name}</span>
                    <span className="block truncate text-[10px] text-fg-muted">
                      {plotted ? ACTIVITY_MEANING[operator.current_activity].label : "No GPS fix"}
                      {operator.current_order?.complaint_type ? ` · ${operator.current_order.complaint_type}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
