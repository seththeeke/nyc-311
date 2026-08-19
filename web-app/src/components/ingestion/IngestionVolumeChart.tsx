import type { ReactElement } from "react";
import type { PollerMetrics } from "../../models/pollerMetrics";
import { formatAbsoluteDateTime, formatCompactNumber, niceMax } from "./formatters";
import { IV_COLORS } from "./palette";

export interface IngestionVolumeChartProps {
  metrics: PollerMetrics[];
}

const CHART_WINDOW = 40;
const CHART_HEIGHT_PX = 160;

interface Segment {
  key: string;
  value: number;
  color: string;
}

function segmentsFor(run: PollerMetrics): Segment[] {
  return [
    { key: "ingested", value: run.records_ingested, color: IV_COLORS.seriesIngested },
    { key: "duplicates", value: run.duplicates_skipped, color: IV_COLORS.seriesDuplicates },
    { key: "rejected", value: run.records_rejected, color: IV_COLORS.seriesRejected },
  ];
}

function LegendItem({ color, label }: { color: string; label: string }): ReactElement {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

/*
 * Both the direct label and the tooltip anchor with `bottom: <bar-top>%`,
 * not `top`/`bottom-full` against the bar's own (full chart height) box —
 * the chart row sits in an `overflow-x-auto` wrapper, which per the CSS
 * overflow spec forces overflow-y non-visible too, so anything positioned
 * by poking *above* the box (rather than growing up *from* a bottom
 * offset within it) was silently clipped for short bars. `TOOLTIP_GAP`
 * clears the direct label so both can be visible at once on the last bar.
 */
const LABEL_GAP_PX = 4;
const TOOLTIP_GAP_PX = 22;

interface VolumeBarProps {
  run: PollerMetrics;
  axisMax: number;
  isFirst: boolean;
  isLast: boolean;
}

/*
 * Edge bars get a left/right-anchored tooltip instead of centered — a
 * centered tooltip on the first or last bar overflows past the scroll
 * container's horizontal edge and gets clipped there too.
 */
function tooltipAlignClass(isFirst: boolean, isLast: boolean): string {
  if (isFirst) return "left-0";
  if (isLast) return "right-0";
  return "left-1/2 -translate-x-1/2";
}

function VolumeBar({ run, axisMax, isFirst, isLast }: VolumeBarProps): ReactElement {
  const total = run.records_ingested + run.duplicates_skipped + run.records_rejected;
  const totalPct = (total / axisMax) * 100;
  const summary = `${formatAbsoluteDateTime(run.ran_at)}: ${run.records_ingested} ingested, ${run.duplicates_skipped} duplicates skipped, ${run.records_rejected} rejected`;

  return (
    <div className="group relative flex h-full w-5 shrink-0 flex-col-reverse items-stretch gap-[2px]">
      {segmentsFor(run).map((segment) => (
        <div
          key={segment.key}
          className="w-full last:rounded-t-sm"
          style={{ height: `${(segment.value / axisMax) * 100}%`, backgroundColor: segment.color }}
        />
      ))}
      {!run.success && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] rounded-t-sm"
          style={{ backgroundColor: IV_COLORS.statusCritical }}
        />
      )}
      {isLast && total > 0 && (
        <span
          className="pointer-events-none absolute right-0 text-[10px] font-medium whitespace-nowrap text-slate-600"
          style={{ bottom: `calc(${totalPct}% + ${LABEL_GAP_PX}px)` }}
        >
          {formatCompactNumber(total)}
        </span>
      )}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute z-10 w-max max-w-56 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${tooltipAlignClass(isFirst, isLast)}`}
        style={{ bottom: `calc(${totalPct}% + ${TOOLTIP_GAP_PX}px)` }}
      >
        <span className="block font-medium">{formatAbsoluteDateTime(run.ran_at)}</span>
        {run.success ? (
          <>
            <span className="block text-slate-300">{run.records_ingested} ingested</span>
            <span className="block text-slate-300">{run.duplicates_skipped} duplicates</span>
            <span className="block text-slate-300">{run.records_rejected} rejected</span>
          </>
        ) : (
          <span className="block text-slate-300">Failed{run.error_message ? `: ${run.error_message}` : ""}</span>
        )}
      </span>
      <button
        type="button"
        aria-label={summary}
        className="absolute inset-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      />
    </div>
  );
}

/*
 * Part-to-whole per run (dataviz skill): each bar's total is "records
 * looked at this run" (ingested + duplicates + rejected), stacked in the
 * three fixed categorical slots so composition and volume read together.
 */
export function IngestionVolumeChart({ metrics }: IngestionVolumeChartProps): ReactElement {
  const recent = metrics.slice(0, CHART_WINDOW);
  const chronological = [...recent].reverse();
  const totals = chronological.map((run) => run.records_ingested + run.duplicates_skipped + run.records_rejected);
  const axisMax = niceMax(Math.max(...totals, 1));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <LegendItem color={IV_COLORS.seriesIngested} label="Ingested" />
        <LegendItem color={IV_COLORS.seriesDuplicates} label="Duplicates skipped" />
        <LegendItem color={IV_COLORS.seriesRejected} label="Rejected" />
        <LegendItem color={IV_COLORS.statusCritical} label="Failed run" />
      </div>

      {/* pt reserves headroom for the direct label + hover tooltip, which
          grow upward from inside each bar's own box (see VolumeBar) —
          without it, the tallest bar's tooltip could be clipped by the
          overflow-x-auto scroller below (overflow-x non-visible forces
          overflow-y non-visible too, per the CSS overflow spec). */}
      <div className="mt-4 flex gap-3 overflow-x-auto pt-16 pb-1">
        <div
          className="flex flex-col justify-between text-right text-[10px] text-slate-400"
          style={{ height: CHART_HEIGHT_PX }}
        >
          <span>{formatCompactNumber(axisMax)}</span>
          <span>{formatCompactNumber(Math.round(axisMax / 2))}</span>
          <span>0</span>
        </div>

        <div
          className="relative flex flex-1 items-end gap-1 border-b border-l border-slate-200"
          style={{ height: CHART_HEIGHT_PX }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-slate-100" />
          {chronological.map((run, index) => (
            <VolumeBar
              key={run.ran_at}
              run={run}
              axisMax={axisMax}
              isFirst={index === 0}
              isLast={index === chronological.length - 1}
            />
          ))}
        </div>
      </div>

      {chronological.length > 0 && (
        <p className="mt-2 text-xs text-slate-400">
          {formatAbsoluteDateTime(chronological[0].ran_at).split(",")[0]} –{" "}
          {formatAbsoluteDateTime(chronological[chronological.length - 1].ran_at).split(",")[0]}
        </p>
      )}
    </div>
  );
}
