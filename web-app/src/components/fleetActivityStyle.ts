import type { OperatorActivity } from "../models/fleetLocation";

/* Literal strings, not built from a template — see MonitoringTile.tsx's identical note on Tailwind's static scanner. */
export const ACTIVITY_COLOR: Record<OperatorActivity, string> = {
  IDLE: "#10b981",
  TRANSIT: "#f59e0b",
  WORKING: "#3b82f6",
};

/* What each truck colour means, shown in the map legend. */
export const ACTIVITY_MEANING: Record<OperatorActivity, { label: string; meaning: string }> = {
  IDLE: { label: "Idle", meaning: "available" },
  TRANSIT: { label: "In transit", meaning: "heading to a job" },
  WORKING: { label: "Working", meaning: "on a job" },
};

export const ACTIVITY_ORDER: readonly OperatorActivity[] = ["IDLE", "TRANSIT", "WORKING"];
