/*
 * A human-friendly front end over the one thing the backend actually
 * stores: an EventBridge Scheduler `cron(Minutes Hours DayOfMonth Month
 * DayOfWeek Year)` string (7-data-warehousing.md §12b). Not a zod-parsed
 * network model — this is purely client-side UI state, translated to/from
 * the raw cron string the API accepts.
 */

export const CRON_PRESET_KINDS = ["daily", "hourly", "weekly", "custom"] as const;
export type CronPresetKind = (typeof CRON_PRESET_KINDS)[number];

export const CRON_DAYS_OF_WEEK = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
export type CronDayOfWeek = (typeof CRON_DAYS_OF_WEEK)[number];

export const CRON_DAY_OF_WEEK_LABELS: Record<CronDayOfWeek, string> = {
  SUN: "Sunday",
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
};

export interface CronPreset {
  kind: CronPresetKind;
  /** daily/weekly: 0-23 */
  hour: number;
  /** daily/hourly/weekly: 0-59 */
  minute: number;
  /** weekly only */
  dayOfWeek: CronDayOfWeek;
  /** custom only — a raw `cron(...)` string, used verbatim */
  raw: string;
}

export const DEFAULT_CRON_PRESET: CronPreset = {
  kind: "daily",
  hour: 9,
  minute: 0,
  dayOfWeek: "MON",
  raw: "",
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Builds the `cron(...)` expression EventBridge Scheduler expects from a {@link CronPreset}. */
export function buildCronExpression(preset: CronPreset): string {
  switch (preset.kind) {
    case "daily":
      return `cron(${preset.minute} ${preset.hour} * * ? *)`;
    case "hourly":
      return `cron(${preset.minute} * * * ? *)`;
    case "weekly":
      return `cron(${preset.minute} ${preset.hour} ? * ${preset.dayOfWeek} *)`;
    case "custom":
      return preset.raw.trim();
  }
}

/**
 * Best-effort reverse mapping from a raw cron string back to a
 * human-readable description — falls back to showing the raw expression
 * for anything a preset didn't produce (a hand-typed custom schedule).
 */
export function describeCron(cronExpression: string): string {
  const match = /^cron\((\S+) (\S+) (\S+) (\S+) (\S+) (\S+)\)$/.exec(cronExpression.trim());
  if (!match) return cronExpression;
  const [, minute, hour, dayOfMonth, , dayOfWeek] = match;

  if (dayOfMonth === "*" && dayOfWeek === "?" && /^\d+$/.test(minute) && /^\d+$/.test(hour)) {
    return `Daily at ${pad(Number(hour))}:${pad(Number(minute))} UTC`;
  }
  if (hour === "*" && dayOfMonth === "*" && dayOfWeek === "?" && /^\d+$/.test(minute)) {
    return `Hourly at :${pad(Number(minute))}`;
  }
  if (
    dayOfMonth === "?" &&
    (CRON_DAYS_OF_WEEK as readonly string[]).includes(dayOfWeek) &&
    /^\d+$/.test(minute) &&
    /^\d+$/.test(hour)
  ) {
    return `Weekly on ${CRON_DAY_OF_WEEK_LABELS[dayOfWeek as CronDayOfWeek]} at ${pad(Number(hour))}:${pad(Number(minute))} UTC`;
  }
  return cronExpression;
}
