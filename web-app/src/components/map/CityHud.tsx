import type { ReactElement } from "react";
import type { FleetOperatorLocation } from "../../models/fleetLocation";
import { ACTIVITY_COLOR, ACTIVITY_MEANING, ACTIVITY_ORDER } from "../fleetActivityStyle";
import { SpinnerIcon } from "../icons";
import { GLASS } from "./hudStyle";

interface CityHudProps {
  operators: FleetOperatorLocation[];
  isLoading: boolean;
  error: Error | null;
  /** Steps aside in a narrow workspace, where the vehicle card needs the room. */
  yieldWhenNarrow: boolean;
}

/** The title card: what this is, that it's live, and the fleet's activity mix — which doubles as the colour legend. */
export function CityHud({ operators, isLoading, error, yieldWhenNarrow }: CityHudProps): ReactElement {
  return (
    <section aria-label="Fleet summary" className={`${GLASS} pointer-events-auto w-80 shrink-0 p-4 ${yieldWhenNarrow ? "@max-3xl:hidden" : ""}`}>
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold tracking-[0.18em] text-fg uppercase">Fleet</h1>
        {isLoading ? (
          <span role="status" className="flex items-center gap-1.5 text-xs text-fg-muted">
            <SpinnerIcon className="h-3.5 w-3.5" /> Loading
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-fg-muted">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-hue-emerald opacity-75 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-hue-emerald" />
            </span>
            Live
          </span>
        )}
      </div>
      <ul className="mt-3 grid grid-cols-3 gap-2">
        {ACTIVITY_ORDER.map((activity) => {
          const count = operators.filter((o) => o.current_activity === activity).length;
          return (
            <li key={activity} className="rounded-xl border border-line/50 bg-panel/60 px-2.5 py-2">
              <div className="flex items-center gap-1.5 text-[11px] whitespace-nowrap text-fg-muted">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ACTIVITY_COLOR[activity], boxShadow: `0 0 8px ${ACTIVITY_COLOR[activity]}` }} />
                {ACTIVITY_MEANING[activity].label}
              </div>
              <div className="mt-0.5 text-xl font-semibold text-fg tabular-nums">{count}</div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] leading-snug text-fg-subtle">Click a truck, or pick one from the roster, to follow it and dive into its job.</p>
      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-danger-soft px-2.5 py-1.5 text-xs text-danger">
          Couldn&apos;t load the fleet: {error.message}
        </p>
      )}
    </section>
  );
}
