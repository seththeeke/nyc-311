import type { IdeaResolution, IdeaType, ResolutionStatus } from "../../models/residentIdea";

/* Shared display helpers for the Residents page. */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** "just now", "12m ago", "3h ago", "2d ago" — relative to `now`. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const elapsed = now.getTime() - Date.parse(iso);
  if (!Number.isFinite(elapsed) || elapsed < MINUTE_MS) return "just now";
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)}m ago`;
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)}h ago`;
  return `${Math.floor(elapsed / DAY_MS)}d ago`;
}

/** "05:00–18:00"; a window that wraps midnight reads the same way ("21:00–05:00"). */
export function activeHoursLabel(hours: { start: number; end: number }): string {
  const pad = (hour: number): string => `${String(hour).padStart(2, "0")}:00`;
  return `${pad(hours.start)}–${pad(hours.end)}`;
}

/** "BROOKLYN" -> "Brooklyn". */
export function titleCase(value: string): string {
  return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/* Plain labels only — idea types are not colour-coded, since none is more urgent than another. */
export const IDEA_TYPE_LABELS: Record<IdeaType, string> = {
  STATUS_CHECK: "Status check",
  SERVICED_CHECK: "Serviced?",
  ETA_REQUEST: "ETA request",
  PRIORITY_INQUIRY: "Priority",
  ESCALATION: "Escalation",
  FEATURE_REQUEST: "Feature request",
};

/* Each tool a resident can use, as a short past-tense chip (docs/16 §5.1). An unknown tool shows its own name. */
export const TOOL_LABELS: Record<string, string> = {
  SEARCH_REQUESTS: "Searched requests",
  CREATE_FEATURE_REQUEST: "Filed a feature request",
  GET_FEATURE_REQUEST: "Checked a feature request",
  BROWSE_WEBSITE: "Browsed the website",
  finish_idea: "Finished",
};

export function toolLabel(tool: string): string {
  return TOOL_LABELS[tool] ?? tool;
}

/* The badge on every idea (docs/16 §6.1). */
export type ResolutionBadgeState = ResolutionStatus | "STALLED";
export const RESOLUTION_LABELS: Record<ResolutionBadgeState, string> = {
  NOT_ACTIONED: "Not actioned",
  IN_PROGRESS: "Working on it…",
  STALLED: "Stalled",
  SATISFIED: "Satisfied",
  UNSATISFIED: "Unsatisfied",
  GAVE_UP: "Gave up",
  MAX_DEPTH_REACHED: "Hit the limit",
};

/* An idea still being worked after this long has most likely stopped (a dead-lettered message). */
export const STALLED_AFTER_MS = HOUR_MS;

/** The badge state: an in-progress idea started over an hour ago reads as stalled. */
export function resolutionState(resolution: IdeaResolution, now: Date = new Date()): ResolutionBadgeState {
  if (resolution.status !== "IN_PROGRESS" || !resolution.started_at) return resolution.status;
  return now.getTime() - Date.parse(resolution.started_at) > STALLED_AFTER_MS ? "STALLED" : "IN_PROGRESS";
}

/** "1.4s" / "320ms" between two timestamps; "—" when either is missing. */
export function durationLabel(from: string | null, to: string | null): string {
  if (!from || !to) return "—";
  const ms = Math.max(0, Date.parse(to) - Date.parse(from));
  return ms < 1000 ? `${ms}ms` : ms < MINUTE_MS ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms / MINUTE_MS)}m`;
}
