import type { ReactElement } from "react";
import { useWorkspaceMetrics } from "../../hooks/useWorkspaceMetrics";
import type { WorkspaceMetricId } from "../../models/workspaceMetrics";
import { MetricTileBody } from "./MetricTileBody";
import { formatWeekDelta, formatWeekLabel } from "./workspaceMetricFormat";

interface WorkspaceMetricTileProps {
  metricId: WorkspaceMetricId;
  /** Used in the accessible name, e.g. "Serviced". */
  label: string;
  formatValue: (value: number) => string;
}

/**
 * One `GET /workspace/metrics` value as a tile: the week to date, with
 * the change against the same days of the week before as its caption.
 * Every metric tile reads the same cached query, so the panel makes one
 * request, not one per tile.
 */
export function WorkspaceMetricTile({ metricId, label, formatValue }: WorkspaceMetricTileProps): ReactElement {
  const { data, isPending, isError } = useWorkspaceMetrics();

  if (isPending) {
    return (
      <div role="status" aria-label={`${label}: loading`}>
        <MetricTileBody value="—" detail="loading…" />
      </div>
    );
  }
  if (isError) {
    return (
      <div role="alert">
        <MetricTileBody value="—" detail="unavailable" />
      </div>
    );
  }

  const { current, previous } = data.metrics[metricId];
  if (current === null) {
    return (
      <div role="status" aria-label={`${label}: no data yet`}>
        <MetricTileBody value="—" detail="no data yet" />
      </div>
    );
  }

  /* This week so far, compared against the same days of the week before — not two full weeks. */
  const week = `week to date from ${formatWeekLabel(data.week_start)}`;
  const delta = formatWeekDelta(current, previous);
  const value = formatValue(current);
  return (
    <div
      role="status"
      aria-label={`${label}: ${value}, ${week}${delta ? `, ${delta}` : ""}`}
      data-tooltip={previous === null ? week : `${week} vs. the same days of the week before`}
    >
      <MetricTileBody value={value} detail={delta ?? week} />
    </div>
  );
}
