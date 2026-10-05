import { LIVE_METRICS_TIME_ZONE } from "../../models/liveWorkspaceMetrics";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const NEW_YORK_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: LIVE_METRICS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The New York calendar date (`YYYY-MM-DD`) an instant falls on — DST handled by the zone database. */
export function newYorkDate(instant: Date): string {
  const parts = new Map(NEW_YORK_DATE_FORMAT.formatToParts(instant).map((part) => [part.type, part.value]));
  return `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`;
}

/* Calendar dates are compared and stepped as UTC midnights, so no zone or DST arithmetic leaks in. */
function toUtcMidnight(day: string): number {
  return Date.parse(`${day}T00:00:00.000Z`);
}

/** `day` shifted by `offset` calendar days (negative goes back). */
export function addDays(day: string, offset: number): string {
  return new Date(toUtcMidnight(day) + offset * MS_PER_DAY).toISOString().slice(0, 10);
}

/** The Monday that starts `day`'s week — weeks run Monday to Sunday, resetting at the midnight that ends Sunday. */
export function weekStartOf(day: string): string {
  const daysSinceMonday = (new Date(toUtcMidnight(day)).getUTCDay() + 6) % 7;
  return addDays(day, -daysSinceMonday);
}

/** Every day from `weekStart` through `day`, inclusive — the week to date. */
export function weekToDateDays(weekStart: string, day: string): string[] {
  const count = Math.round((toUtcMidnight(day) - toUtcMidnight(weekStart)) / MS_PER_DAY) + 1;
  return Array.from({ length: count }, (_, index) => addDays(weekStart, index));
}
