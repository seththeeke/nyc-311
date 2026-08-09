// Colors sourced from the dataviz skill's validated default palette
// (categorical order + status roles) so map, charts, and badges share one
// system. See docs in the dataviz skill for why the order is fixed.

const CATEGORICAL = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"] as const;
// dark-surface steps for the immersive map background (palette.md dark column)
const CATEGORICAL_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"] as const;

export const AGENCY_ORDER = ["DSNY", "NYPD", "DOT", "HPD", "DEP"] as const;
export const AGENCY_COLORS: Record<string, string> = Object.fromEntries(AGENCY_ORDER.map((a, i) => [a, CATEGORICAL[i]]));
export const AGENCY_COLORS_DARK: Record<string, string> = Object.fromEntries(AGENCY_ORDER.map((a, i) => [a, CATEGORICAL_DARK[i]]));

export const BOROUGH_ORDER = ["MANHATTAN", "BROOKLYN", "QUEENS", "BRONX", "STATEN ISLAND"] as const;
export const BOROUGH_COLORS: Record<string, string> = Object.fromEntries(BOROUGH_ORDER.map((b, i) => [b, CATEGORICAL[i]]));
export const BOROUGH_COLORS_DARK: Record<string, string> = Object.fromEntries(BOROUGH_ORDER.map((b, i) => [b, CATEGORICAL_DARK[i]]));

export function agencyColor(agency: string, mode: "light" | "dark" = "light"): string {
  return (mode === "dark" ? AGENCY_COLORS_DARK : AGENCY_COLORS)[agency] ?? "#8b93a1";
}

export function boroughColor(borough: string, mode: "light" | "dark" = "light"): string {
  return (mode === "dark" ? BOROUGH_COLORS_DARK : BOROUGH_COLORS)[borough] ?? "#8b93a1";
}

// status palette — fixed roles, never reused for series identity
export const STATUS = {
  good: "#0ca30c",
  goodText: "#006300",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
};

export const PRIORITY_COLORS: Record<string, string> = {
  critical: STATUS.critical,
  high: STATUS.warning,
  standard: CATEGORICAL[0],
};

export const STAGE_LABELS: Record<string, string> = {
  Ingest: "Ingest",
  Schedule: "Schedule",
  Execute: "In Progress",
  Resolve: "Resolving",
};

export const CASE_STATUS_COLORS: Record<string, string> = {
  created: "#898781",
  under_investigation: CATEGORICAL[0],
  auto_resolved: STATUS.good,
  escalated: STATUS.warning,
  resolved_by_admin: STATUS.goodText,
  closed: "#52514e",
};

export const CASE_STATUS_LABELS: Record<string, string> = {
  created: "Created",
  under_investigation: "Investigating",
  auto_resolved: "Auto-Resolved",
  escalated: "Escalated",
  resolved_by_admin: "Resolved by Admin",
  closed: "Closed",
};

export const QUEUE_LABELS: Record<string, string> = {
  "system-failure": "System Failure",
  "capacity-escalation": "Capacity Escalation",
};

export function activityLabel(activity: string): string {
  return { idle: "Idle", transit: "En Route", working: "On Scene", off_shift: "Off Shift" }[activity] ?? activity;
}
