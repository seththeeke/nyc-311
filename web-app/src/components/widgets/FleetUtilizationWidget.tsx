import type { ReactElement } from "react";
import { useFleetLocations } from "../../hooks/useFleetLocations";
import { OPERATOR_ACTIVITIES, type OperatorActivity } from "../../models/fleetLocation";
import { ACTIVITY_MEANING } from "../fleetActivityStyle";
import { describeShares, toShares } from "./chartShares";
import { ShareLegend } from "./ShareLegend";

/* Most-active first, matching the map legend's ACTIVITY_ORDER reversed and the widget's original mock ordering. */
const DISPLAY_ORDER: readonly OperatorActivity[] = ["WORKING", "TRANSIT", "IDLE"];

/**
 * Share of the active fleet by activity, as a left-to-right stacked bar. Built
 * entirely from `useFleetLocations` — the same query (and cache) the map,
 * legend, and `CapacityWidget` already use, so this widget adds no backend
 * call of its own. Always shows all three activities, even at 0%, so the
 * legend stays a stable key rather than reshuffling as the fleet moves.
 */
export function FleetUtilizationWidget(): ReactElement {
  const { locations, isLoading, error } = useFleetLocations();

  if (isLoading) return <p className="text-xs text-fg-subtle">Loading…</p>;
  if (error) {
    return (
      <p role="alert" className="text-xs text-danger">
        Fleet data unavailable.
      </p>
    );
  }
  const operators = locations?.operators ?? [];
  if (operators.length === 0) return <p className="text-xs text-fg-subtle">No active operators.</p>;

  /* Pre-populated for every activity, so the two `.get()` calls below are never undefined — no `?? 0` fallback needed. */
  const counts = new Map<OperatorActivity, number>(OPERATOR_ACTIVITIES.map((activity) => [activity, 0]));
  for (const operator of operators) counts.set(operator.current_activity, counts.get(operator.current_activity)! + 1);
  const shares = toShares(
    DISPLAY_ORDER.map((activity) => ({ label: ACTIVITY_MEANING[activity].label, value: counts.get(activity)! })),
  );

  return (
    <div>
      <div
        role="img"
        aria-label={`Fleet utilization: ${describeShares(shares)}`}
        className="flex h-6 w-full gap-0.5 overflow-hidden rounded-md"
      >
        {shares.map((share) => (
          <div
            key={share.label}
            title={`${share.label}: ${Math.round(share.percent)}%`}
            className="h-full first:rounded-l-md last:rounded-r-md"
            style={{ width: `${share.percent}%`, backgroundColor: share.color }}
          />
        ))}
      </div>
      <div className="mt-2">
        <ShareLegend shares={shares} />
      </div>
    </div>
  );
}
