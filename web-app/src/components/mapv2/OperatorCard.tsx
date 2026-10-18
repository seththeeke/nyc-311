import type { ReactElement } from "react";
import type { FleetOperatorLocation } from "../../models/fleetLocation";
import { ACTIVITY_COLOR, ACTIVITY_MEANING } from "../fleetActivityStyle";
import { GLASS } from "./hudStyle";
import { MapV2Glyph } from "./MapV2Glyph";

interface OperatorCardProps {
  operator: FleetOperatorLocation;
  onDive: () => void;
  onClose: () => void;
  /** True while the camera is plunging toward the job — the dive button shows progress instead. */
  diving: boolean;
}

/** The selected vehicle: what it's doing, its current job, and the way into that job. */
export function OperatorCard({ operator, onDive, onClose, diving }: OperatorCardProps): ReactElement {
  const color = ACTIVITY_COLOR[operator.current_activity];
  const order = operator.current_order;
  return (
    <section aria-label={`${operator.name} details`} className={`${GLASS} pointer-events-auto w-80 shrink-0 p-4 motion-safe:animate-[fade-in-up_300ms_ease-out]`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-fg">{operator.name}</h2>
          <span className="mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium text-fg" style={{ backgroundColor: `${color}26`, boxShadow: `inset 0 0 0 1px ${color}66` }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
            {ACTIVITY_MEANING[operator.current_activity].label} — {ACTIVITY_MEANING[operator.current_activity].meaning}
          </span>
        </div>
        <button type="button" aria-label="Close vehicle details" onClick={onClose} className="rounded-lg p-1.5 text-fg-muted hover:bg-panel-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-hue-cyan focus-visible:outline-none">
          <MapV2Glyph name="CLOSE" />
        </button>
      </div>
      {order ? (
        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="text-[11px] tracking-wider text-fg-subtle uppercase">Job</dt>
            <dd className="text-fg">{order.complaint_type ?? "Unspecified job"}</dd>
          </div>
          <div>
            <dt className="text-[11px] tracking-wider text-fg-subtle uppercase">Where</dt>
            <dd className="text-fg">{order.location_address ?? "Address unavailable"}</dd>
          </div>
          <div>
            <dt className="text-[11px] tracking-wider text-fg-subtle uppercase">Order</dt>
            <dd className="font-mono text-xs text-fg-muted">{order.order_id}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-4 text-sm text-fg-muted">No job assigned right now.</p>
      )}
      {order && (
        <button
          type="button"
          onClick={onDive}
          disabled={diving}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-on-accent shadow-lg transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-hue-cyan focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-70"
        >
          <MapV2Glyph name="DIVE" />
          {diving ? "Diving in…" : "Dive into job"}
        </button>
      )}
    </section>
  );
}
