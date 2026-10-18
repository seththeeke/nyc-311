import type { ActionType, IdeaType } from "../../models/residentIdea";

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

/* What a resident did about an idea, as a short past-tense tag. */
export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  REQUEST_FEATURE: "Requested a feature",
  CHECK_STATUS_API: "Checked status via API",
  BROWSE_WEBSITE: "Browsed the website",
};
export const NOT_ACTIONED_LABEL = "Not actioned yet";

/** "1:05" for 65 seconds. */
export function clockTime(totalSeconds: number): string {
  const seconds = Math.floor(totalSeconds);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
