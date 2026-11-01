import type { ActionStatus, ScorecardEntry, ScorecardMetric } from "../../models/staffMeeting";

/* Display helpers for the Meet the Team page (#146). */

export function formatMetric(value: number, unit: ScorecardEntry["unit"]): string {
  if (unit === "PERCENT") return `${value.toFixed(1)}%`;
  if (unit === "USD") return `$${value.toFixed(2)}`;
  return String(value);
}

export type Trend = "BETTER" | "WORSE" | "FLAT";

/** Whether the metric moved the good way since the last meeting. */
export function metricTrend(entry: ScorecardEntry): Trend {
  if (entry.previous === null || entry.previous === entry.value) return "FLAT";
  const rose = entry.value > entry.previous;
  return rose === (entry.better === "UP") ? "BETTER" : "WORSE";
}

/** Whether the metric meets its target today. */
export function onTarget(entry: ScorecardEntry): boolean {
  return entry.better === "UP" ? entry.value >= entry.target : entry.value <= entry.target;
}

/** "12:04" in UTC, the Mac mini's meeting clock. */
export function clockTime(iso: string): string {
  return iso.slice(11, 16);
}

/** "Fri, Oct 31" from a calendar date. */
export function meetingDay(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

export function minutesBetween(start: string, end: string): number {
  return Math.round((Date.parse(end) - Date.parse(start)) / 60000);
}

export const STATUS_LABEL: Record<ActionStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  BLOCKED: "Blocked",
};

export const STATUS_CLASSES: Record<ActionStatus, string> = {
  OPEN: "bg-sky-500/15 text-hue-sky",
  IN_PROGRESS: "bg-amber-500/15 text-hue-amber",
  DONE: "bg-emerald-500/15 text-hue-emerald",
  BLOCKED: "bg-rose-500/15 text-hue-rose",
};

/* Each role's accent, so a speaker reads at a glance in the transcript. */
export const ROLE_ACCENT: Record<string, string> = {
  CEO: "border-l-indigo-500",
  CHIEF_OF_STAFF: "border-l-violet-500",
  COO: "border-l-amber-500",
  CPO: "border-l-teal-500",
  CFO: "border-l-rose-500",
  CTO: "border-l-sky-500",
  ENGINEER: "border-l-emerald-500",
};

export const METRIC_LABEL: Record<ScorecardMetric, string> = {
  ON_TIME_RATE: "On-time orders",
  OPEN_BACKLOG: "Open backlog",
  ACTIVE_DRIVERS: "Active drivers",
  COST_PER_ORDER: "Cost per order",
  EXECUTION_FAILURE_RATE: "Failure rate",
  AWS_SPEND_MTD: "AWS spend",
  OPEN_FEATURE_REQUESTS: "Feature requests",
};
