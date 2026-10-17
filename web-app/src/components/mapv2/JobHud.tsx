import type { ReactElement } from "react";
import type { FleetOperatorLocation } from "../../models/fleetLocation";
import { ACTIVITY_COLOR, ACTIVITY_MEANING } from "../fleetActivityStyle";
import { GLASS } from "./hudStyle";
import { MapV2Glyph } from "./MapV2Glyph";
import { type JobScript, phasesFor, type TimelineState } from "./repairTimeline";

interface JobHudProps {
  operator: FleetOperatorLocation;
  script: JobScript;
  timeline: TimelineState;
  onExit: () => void;
}

/** The dive-in's overlay: the real job's details, and a stepper tracking the illustrative repair loop. */
export function JobHud({ operator, script, timeline, onExit }: JobHudProps): ReactElement {
  const order = operator.current_order;
  const phases = phasesFor(script);
  const color = ACTIVITY_COLOR[operator.current_activity];
  return (
    <>
      <section aria-label="Job details" className={`${GLASS} absolute top-4 left-4 z-10 w-80 p-4 motion-safe:animate-[fade-in-up_500ms_ease-out]`}>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.16em] uppercase" style={{ color }}>
          <span className="h-1.5 w-1.5 rounded-full motion-safe:animate-pulse" style={{ backgroundColor: color }} />
          {ACTIVITY_MEANING[operator.current_activity].label}
        </span>
        <h2 className="mt-1.5 text-xl font-semibold text-fg">{order?.complaint_type ?? "Crew at work"}</h2>
        <p className="mt-0.5 text-sm text-fg-muted">{order?.location_address ?? "Address unavailable"}</p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-fg-subtle">Vehicle</dt>
            <dd className="text-fg">{operator.name}</dd>
          </div>
          <div>
            <dt className="text-fg-subtle">Order</dt>
            <dd className="truncate font-mono text-fg-muted">{order?.order_id}</dd>
          </div>
        </dl>
      </section>
      <button
        type="button"
        onClick={onExit}
        className={`${GLASS} absolute top-16 right-4 z-10 flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-fg hover:bg-panel-hover focus-visible:ring-2 focus-visible:ring-hue-cyan focus-visible:outline-none`}
      >
        <MapV2Glyph name="BACK" />
        Back to city <kbd className="rounded border border-line px-1 text-[10px] text-fg-subtle">Esc</kbd>
      </button>
      <section aria-label="Repair progress" className={`${GLASS} absolute bottom-6 left-1/2 z-10 w-[min(44rem,calc(100%-2rem))] -translate-x-1/2 p-3`}>
        <ol className="flex gap-1.5">
          {phases.map((spec, i) => {
            const fill = i < timeline.index ? 1 : i === timeline.index ? timeline.progress : 0;
            const current = i === timeline.index;
            return (
              <li key={spec.phase} aria-current={current ? "step" : undefined} className="min-w-0 flex-1">
                <div className="h-1 overflow-hidden rounded-full bg-panel-strong">
                  <div className="h-full rounded-full bg-hue-cyan transition-[width] duration-150" style={{ width: `${Math.round(fill * 100)}%` }} />
                </div>
                <p className={`mt-1.5 text-[11px] leading-tight ${current ? "font-semibold text-fg" : "text-fg-subtle"}`}>{spec.label}</p>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-center text-[10px] text-fg-subtle">Illustrative animation — the API reports that this crew is working, not each step.</p>
      </section>
    </>
  );
}
