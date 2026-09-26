/** Hours as a compact duration: "57m", "1h 01m", "4d 19h". */
export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) {
    let wholeHours = Math.floor(hours);
    let minutes = Math.round((hours - wholeHours) * 60);
    if (minutes === 60) {
      wholeHours += 1;
      minutes = 0;
    }
    return wholeHours === 24 ? "1d 0h" : `${wholeHours}h ${String(minutes).padStart(2, "0")}m`;
  }
  let days = Math.floor(hours / 24);
  let remainder = Math.round(hours - days * 24);
  if (remainder === 24) {
    days += 1;
    remainder = 0;
  }
  return `${days}d ${remainder}h`;
}

export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

/** Whole US dollars: "$421,380". */
export function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

/** Week-over-week change, e.g. "↓ 51% vs. last week"; `null` when there's no prior week to compare against. */
export function formatWeekDelta(current: number, previous: number | null): string | null {
  if (previous === null || previous === 0) return null;
  const percent = Math.round(((current - previous) / Math.abs(previous)) * 100);
  if (percent === 0) return "no change vs. last week";
  return `${percent > 0 ? "↑" : "↓"} ${Math.abs(percent)}% vs. last week`;
}

/** "2026-09-21" → "Sep 21" — parsed as UTC so the label never shifts a day in a western time zone. */
export function formatWeekLabel(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
