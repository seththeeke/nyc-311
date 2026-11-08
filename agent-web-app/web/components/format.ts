import type { ScheduleSlot } from "../../shared/models/scheduleSlot.ts";

/** "Sat 14:00" style local time, with the date when it isn't within the coming or past week. */
export function formatWhen(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const days = Math.abs(date.getTime() - now.getTime()) / 86_400_000;
  if (date.toDateString() === now.toDateString()) return `today ${time}`;
  if (days < 6) return `${date.toLocaleDateString([], { weekday: "short" })} ${time}`;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

/** 108 → "1m 48s". */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
}

/** Elapsed time since `iso`, for a running run. */
export function formatElapsed(iso: string, now: Date = new Date()): string {
  return formatDuration(Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 1000)));
}

export function formatSlot(slot: ScheduleSlot): string {
  return `${slot.day ? `${slot.day} ` : ""}${slot.time}${slot.mode ? ` ${slot.mode}` : ""}`;
}
