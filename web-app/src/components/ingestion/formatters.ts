/* Small formatting helpers shared across the ingestion-metrics dashboard. */

/** 1,284 for small values; 12.9K/4.2M once it's large enough to compact. */
export function formatCompactNumber(value: number): string {
  if (value < 10_000) return value.toLocaleString("en-US");
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

/** "18 hours ago" / "in 2 minutes", relative to `now`. */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const diffMs = new Date(iso).getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / 60_000);
  const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, "hour");
  const diffDays = Math.round(diffHours / 24);
  return rtf.format(diffDays, "day");
}

/** "Aug 15, 2026, 3:12 PM" — the absolute counterpart to formatRelativeTime. */
export function formatAbsoluteDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Rounds up to a "clean" axis ceiling (10 / 25 / 50 / 100 / 250 / 500 / 1000 steps). */
export function niceMax(value: number): number {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude; /* always in [1, 10) */
  const step = normalized <= 1 ? 1 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}
