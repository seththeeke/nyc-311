// Small formatting helpers scoped to the pipeline-monitoring feature —
// same functions as components/ingestion/formatters.ts, kept duplicated
// rather than shared, so each feature folder stays self-contained
// (matches how the ingestion feature's own formatters.ts is scoped).

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

/** "Aug 16, 2026, 3:12 PM" — the absolute counterpart to formatRelativeTime. */
export function formatAbsoluteDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** "4m 12s" between two ISO timestamps, or up to `now` if `endIso` is null (still running). */
export function formatDuration(startIso: string, endIso: string | null, now: Date = new Date()): string {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : now.getTime();
  const totalSeconds = Math.max(0, Math.round((end - start) / 1000));

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}
