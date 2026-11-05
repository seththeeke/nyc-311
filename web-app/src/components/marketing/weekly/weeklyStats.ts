import type { FleetLocations } from "../../../models/fleetLocation";
import type { WorkspaceMetrics } from "../../../models/workspaceMetrics";
import { formatWeekDelta, formatWeekLabel } from "../../widgets/workspaceMetricFormat";

/*
 * The "This week" story's numbers, from the same snapshot the fleet map's
 * workspace shows (`GET /workspace/metrics` and the fleet roster). Null means
 * the API hasn't answered or has no value yet.
 */
export interface WeeklyStats {
  weekLabel: string | null;
  operators: number | null;
  /* Operators out on a job (in transit or working), for the tank's level. */
  busy: number | null;
  totalCost: number | null;
  costDelta: string | null;
  accepted: number | null;
  serviced: number | null;
  servicedDelta: string | null;
  meanHours: number | null;
  meanDelta: string | null;
}

function delta(current: number | null, previous: number | null): string | null {
  return current === null ? null : formatWeekDelta(current, previous);
}

export function weeklyStats(snapshot: WorkspaceMetrics | undefined, fleet: FleetLocations | undefined): WeeklyStats {
  const m = snapshot?.metrics;
  return {
    weekLabel: snapshot ? formatWeekLabel(snapshot.week_start) : null,
    operators: fleet ? fleet.operators.length : null,
    busy: fleet ? fleet.operators.filter((op) => op.current_activity !== "IDLE").length : null,
    totalCost: m?.TOTAL_COST.current ?? null,
    costDelta: delta(m?.TOTAL_COST.current ?? null, m?.TOTAL_COST.previous ?? null),
    accepted: m?.REQUESTS_ACCEPTED.current ?? null,
    serviced: m?.SERVICED.current ?? null,
    servicedDelta: delta(m?.SERVICED.current ?? null, m?.SERVICED.previous ?? null),
    meanHours: m?.MEAN_TIME_TO_RESOLVE_HOURS.current ?? null,
    meanDelta: delta(m?.MEAN_TIME_TO_RESOLVE_HOURS.current ?? null, m?.MEAN_TIME_TO_RESOLVE_HOURS.previous ?? null),
  };
}

/** A share in [0, 1]; 0 when either side is unknown or the whole is empty. */
export function share(part: number | null, whole: number | null): number {
  if (part === null || whole === null || whole <= 0) return 0;
  return Math.min(1, Math.max(0, part / whole));
}
