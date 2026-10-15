import type { IdeaType } from "../../models/customerIdea";

/* Shared display helpers for the Customers page. */

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

/** "05:00–18:00", or "21:00–05:00 (overnight)" when the window wraps midnight. */
export function activeHoursLabel(hours: { start: number; end: number }): string {
  const pad = (hour: number): string => `${String(hour).padStart(2, "0")}:00`;
  return `${pad(hours.start)}–${pad(hours.end)}${hours.start > hours.end ? " (overnight)" : ""}`;
}

/** "BROOKLYN" -> "Brooklyn". */
export function titleCase(value: string): string {
  return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

interface IdeaTypeStyle {
  label: string;
  classes: string;
}

export const IDEA_TYPE_STYLES: Record<IdeaType, IdeaTypeStyle> = {
  STATUS_CHECK: { label: "Status check", classes: "bg-sky-500/15 text-hue-sky ring-sky-400/30" },
  SERVICED_CHECK: { label: "Serviced?", classes: "bg-emerald-500/15 text-hue-emerald ring-emerald-400/30" },
  ETA_REQUEST: { label: "ETA request", classes: "bg-indigo-500/15 text-hue-indigo ring-indigo-400/30" },
  PRIORITY_INQUIRY: { label: "Priority", classes: "bg-amber-500/15 text-hue-amber ring-amber-400/30" },
  ESCALATION: { label: "Escalation", classes: "bg-rose-500/15 text-hue-rose ring-rose-400/30" },
  FEATURE_REQUEST: { label: "Feature request", classes: "bg-violet-500/15 text-hue-violet ring-violet-400/30" },
};

const AVATAR_CLASSES = [
  "bg-orange-500/20 text-hue-orange",
  "bg-cyan-500/20 text-hue-cyan",
  "bg-violet-500/20 text-hue-violet",
  "bg-emerald-500/20 text-hue-emerald",
  "bg-rose-500/20 text-hue-rose",
];

/** A stable colour per persona, so the same customer looks the same in both workspaces. */
export function avatarClasses(personaId: string): string {
  /* djb2 — a plain character sum gave two of the three launch personas the same colour. */
  const hash = [...personaId].reduce((acc, char) => (acc * 33 + char.charCodeAt(0)) >>> 0, 5381);
  return AVATAR_CLASSES[hash % AVATAR_CLASSES.length];
}
