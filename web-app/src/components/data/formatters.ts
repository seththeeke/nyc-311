/*
 * Small formatting helpers scoped to the /data feature — the timestamp/
 * duration pair duplicates components/pipeline/formatters.ts on purpose
 * (each feature folder stays self-contained, same precedent as that
 * file's own doc comment); formatBytes/formatMillis are new, specific to
 * the query-performance stats WarehouseJobRun carries.
 */

/** "Aug 16, 2026, 3:12 PM". */
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

/** "4.0 MB" / "128 KB" / "512 B" — null renders as an em dash by the caller, not here. */
export function formatBytes(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_024 * 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / (1_024 * 1_024)).toFixed(1)} MB`;
}

/** "1.84s" for >=1000ms, otherwise "842 ms". */
export function formatMillis(millis: number): string {
  if (millis >= 1_000) return `${(millis / 1_000).toFixed(2)}s`;
  return `${Math.round(millis)} ms`;
}
