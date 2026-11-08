/** `20261107T140004` (a run log's name) as an ISO instant, read in this machine's local time; null if malformed. */
export function runIdToIso(runId: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(runId);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match.map(Number);
  return new Date(y, mo - 1, d, h, mi, s).toISOString();
}

/** `2026-11-07 14:00:04` (a runner log line's stamp) as an ISO instant, in local time; null if malformed. */
export function stampToIso(stamp: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(stamp);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match.map(Number);
  return new Date(y, mo - 1, d, h, mi, s).toISOString();
}
