import type { ReactElement } from "react";
import type { IngestionCursorStatus } from "../../models/pollerMetrics";
import { formatAbsoluteDateTime, formatRelativeTime } from "./formatters";
import { IV_COLORS } from "./palette";

export interface CursorStatusCardProps {
  cursor: IngestionCursorStatus | null;
}

/* SoQL floating_timestamp has no Z/offset suffix (backend's toSoqlTimestamp) — parsed as UTC, matching parseSodaTimestamp. */
function toUtcIso(soqlTimestamp: string): string {
  return `${soqlTimestamp}Z`;
}

interface CursorTileProps {
  label: string;
  value: string;
  title?: string;
  color?: string;
  dot?: boolean;
}

function CursorTile({ label, value, title, color, dot }: CursorTileProps): ReactElement {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-lg font-semibold text-slate-900" style={color ? { color } : undefined} title={title}>
        {dot && <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />}
        {value}
      </p>
    </div>
  );
}

/*
 * Added after the 2026-08-22 fan-out-Lambda incident: the pipeline stalled
 * silently for days (fan-out crashing on every invocation) with no signal
 * anywhere in the UI — this surfaces the cursor's own health so that kind
 * of stall shows up here instead of requiring a manual CloudWatch dig.
 */
export function CursorStatusCard({ cursor }: CursorStatusCardProps): ReactElement {
  if (!cursor) {
    return <p className="text-sm text-slate-500">No ingestion cursor yet — the poller hasn't completed a run.</p>;
  }

  const statusColor = cursor.is_stale ? IV_COLORS.statusCritical : IV_COLORS.statusGood;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <CursorTile
        label="Watermark"
        value={cursor.last_watermark ? formatRelativeTime(toUtcIso(cursor.last_watermark)) : "—"}
        title={cursor.last_watermark ? formatAbsoluteDateTime(toUtcIso(cursor.last_watermark)) : undefined}
      />
      <CursorTile label="Lag" value={cursor.lag_hours !== null ? `${Math.round(cursor.lag_hours)}h` : "—"} />
      <CursorTile
        label="Resume offset"
        value={cursor.resume_offset !== null ? cursor.resume_offset.toLocaleString("en-US") : "Drained"}
      />
      <CursorTile
        label="Status"
        value={cursor.is_stale ? "Stalled" : "Healthy"}
        color={statusColor}
        dot
      />
    </div>
  );
}
