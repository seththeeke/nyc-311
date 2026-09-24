import type { ReactElement } from "react";
import type { PollerMetrics } from "../../models/pollerMetrics";
import { formatAbsoluteDateTime, formatCompactNumber, niceMax } from "./formatters";
import { IV_COLORS } from "./palette";

export interface IngestionVolumeMiniProps {
  metrics: PollerMetrics[];
}

const MINI_WINDOW = 24;
const MINI_HEIGHT_PX = 56;

function totalOf(run: PollerMetrics): number {
  return run.records_ingested + run.duplicates_skipped + run.records_rejected;
}

/**
 * A small, label-free take on `IngestionVolumeChart` for the secondary
 * workspace: same per-run stacked bars in the same three series colors, over
 * the most recent runs only. Each bar's accessible name carries its numbers
 * (and the app-wide tooltip shows them on hover), so nothing is color-only.
 */
export function IngestionVolumeMini({ metrics }: IngestionVolumeMiniProps): ReactElement {
  const chronological = [...metrics.slice(0, MINI_WINDOW)].reverse();
  const axisMax = niceMax(Math.max(...chronological.map(totalOf), 1));

  return (
    <div>
      <ul className="mb-1 flex gap-3 text-[10px] text-fg-subtle">
        {[
          { label: "Ingested", color: IV_COLORS.seriesIngested },
          { label: "Duplicates", color: IV_COLORS.seriesDuplicates },
        ].map((item) => (
          <li key={item.label} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: item.color }} />
            {item.label}
          </li>
        ))}
      </ul>
      <div className="flex items-end gap-px border-b border-line" style={{ height: MINI_HEIGHT_PX }}>
        {chronological.map((run) => (
          <div
            key={run.ran_at}
            role="img"
            data-tooltip={`${formatAbsoluteDateTime(run.ran_at)}: ${run.success ? `${run.records_ingested} ingested` : "failed"}`}
            aria-label={`${formatAbsoluteDateTime(run.ran_at)}: ${run.records_ingested} ingested, ${run.duplicates_skipped} duplicates skipped, ${run.records_rejected} rejected${run.success ? "" : " (failed run)"}`}
            className="flex h-full min-w-0 flex-1 flex-col-reverse gap-px"
          >
            {[
              { key: "ingested", value: run.records_ingested, color: IV_COLORS.seriesIngested },
              { key: "duplicates", value: run.duplicates_skipped, color: IV_COLORS.seriesDuplicates },
              { key: "rejected", value: run.records_rejected, color: IV_COLORS.seriesRejected },
            ].map((segment) => (
              <div key={segment.key} style={{ height: `${(segment.value / axisMax) * 100}%`, backgroundColor: segment.color }} />
            ))}
            {!run.success && <div className="h-[2px]" style={{ backgroundColor: IV_COLORS.statusCritical }} />}
          </div>
        ))}
      </div>
      <p className="mt-1 flex justify-between text-[10px] text-fg-subtle">
        <span>last {chronological.length} runs</span>
        <span>peak {formatCompactNumber(axisMax)}</span>
      </p>
    </div>
  );
}
