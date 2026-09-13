import { useState, type ChangeEvent, type ReactElement } from "react";
import {
  buildCronExpression,
  CRON_DAYS_OF_WEEK,
  CRON_DAY_OF_WEEK_LABELS,
  CRON_PRESET_KINDS,
  DEFAULT_CRON_PRESET,
  type CronDayOfWeek,
  type CronPreset,
  type CronPresetKind,
} from "../../models/cronSchedule";

export interface CronScheduleBuilderProps {
  onChange: (cronExpression: string) => void;
}

const PRESET_LABELS: Record<CronPresetKind, string> = {
  daily: "Daily",
  hourly: "Hourly",
  weekly: "Weekly",
  custom: "Custom (raw cron)",
};

const FIELD_CLASSES =
  "rounded border border-white/10 bg-white/5 px-2 py-1 text-sm text-slate-100 focus:border-cyan-400/50 focus:outline-none";

/**
 * A human-friendly front end over the one thing the backend actually
 * stores: an EventBridge Scheduler `cron(...)` string
 * (7-data-warehousing.md §12b, Leg 8). Presets translate directly to a
 * cron expression; a raw-cron field is the escape hatch for anything a
 * preset doesn't cover. The resulting string is always shown live — real
 * validation is `CreateSchedule` rejecting a malformed one server-side.
 */
export function CronScheduleBuilder({ onChange }: CronScheduleBuilderProps): ReactElement {
  const [preset, setPreset] = useState<CronPreset>(DEFAULT_CRON_PRESET);

  function update(next: CronPreset): void {
    setPreset(next);
    onChange(buildCronExpression(next));
  }

  function handleKindChange(event: ChangeEvent<HTMLSelectElement>): void {
    update({ ...preset, kind: event.target.value as CronPresetKind });
  }

  function handleHourChange(event: ChangeEvent<HTMLInputElement>): void {
    update({ ...preset, hour: Number(event.target.value) });
  }

  function handleMinuteChange(event: ChangeEvent<HTMLInputElement>): void {
    update({ ...preset, minute: Number(event.target.value) });
  }

  function handleDayOfWeekChange(event: ChangeEvent<HTMLSelectElement>): void {
    update({ ...preset, dayOfWeek: event.target.value as CronDayOfWeek });
  }

  function handleRawChange(event: ChangeEvent<HTMLInputElement>): void {
    update({ ...preset, raw: event.target.value });
  }

  const cronExpression = buildCronExpression(preset);

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="cron-preset-kind" className="block text-sm font-medium text-slate-300">
          Cadence
        </label>
        <select id="cron-preset-kind" value={preset.kind} onChange={handleKindChange} className={`${FIELD_CLASSES} mt-1`}>
          {CRON_PRESET_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {PRESET_LABELS[kind]}
            </option>
          ))}
        </select>
      </div>

      {(preset.kind === "daily" || preset.kind === "weekly") && (
        <div className="flex flex-wrap items-end gap-3">
          {preset.kind === "weekly" && (
            <div>
              <label htmlFor="cron-day-of-week" className="block text-xs font-medium text-slate-400">
                Day
              </label>
              <select
                id="cron-day-of-week"
                value={preset.dayOfWeek}
                onChange={handleDayOfWeekChange}
                className={FIELD_CLASSES}
              >
                {CRON_DAYS_OF_WEEK.map((day) => (
                  <option key={day} value={day}>
                    {CRON_DAY_OF_WEEK_LABELS[day]}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="cron-hour" className="block text-xs font-medium text-slate-400">
              Hour (UTC)
            </label>
            <input
              id="cron-hour"
              type="number"
              min={0}
              max={23}
              value={preset.hour}
              onChange={handleHourChange}
              className={`${FIELD_CLASSES} w-20`}
            />
          </div>
          <div>
            <label htmlFor="cron-minute" className="block text-xs font-medium text-slate-400">
              Minute
            </label>
            <input
              id="cron-minute"
              type="number"
              min={0}
              max={59}
              value={preset.minute}
              onChange={handleMinuteChange}
              className={`${FIELD_CLASSES} w-20`}
            />
          </div>
        </div>
      )}

      {preset.kind === "hourly" && (
        <div>
          <label htmlFor="cron-minute-hourly" className="block text-xs font-medium text-slate-400">
            Minute past the hour
          </label>
          <input
            id="cron-minute-hourly"
            type="number"
            min={0}
            max={59}
            value={preset.minute}
            onChange={handleMinuteChange}
            className={`${FIELD_CLASSES} w-20`}
          />
        </div>
      )}

      {preset.kind === "custom" && (
        <div>
          <label htmlFor="cron-raw" className="block text-xs font-medium text-slate-400">
            Raw cron expression
          </label>
          <input
            id="cron-raw"
            type="text"
            placeholder="cron(0 9 * * ? *)"
            value={preset.raw}
            onChange={handleRawChange}
            className={`${FIELD_CLASSES} mt-1 w-full font-mono`}
          />
        </div>
      )}

      <p className="font-mono text-xs text-slate-400">{cronExpression || "cron(...)"}</p>
    </div>
  );
}
