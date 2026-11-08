import { z } from "zod";
import type { LaunchdJob } from "../../shared/models/launchdJob.ts";
import { WEEKDAYS, slotKey } from "./scheduleService.ts";

const calendarEntrySchema = z.object({ Hour: z.number().optional(), Minute: z.number().optional(), Weekday: z.number().optional() });

/** The few plist keys read, as `plutil -convert json` writes them; extra keys pass through. */
const plistSchema = z.object({
  ProgramArguments: z.array(z.string()).optional(),
  StartCalendarInterval: z.union([calendarEntrySchema, z.array(calendarEntrySchema)]).optional(),
});

function pad(value: number | undefined): string {
  return String(value ?? 0).padStart(2, "0");
}

/** Combines the plist (null when not installed) and `launchctl print` (null when not loaded) into one job view. */
export function toLaunchdJob(plistPath: string, plistJson: unknown, launchctlText: string | null): LaunchdJob {
  const plist = plistJson === null ? null : plistSchema.safeParse(plistJson);
  const args = plist?.success ? (plist.data.ProgramArguments ?? []) : [];
  const interval = plist?.success ? plist.data.StartCalendarInterval : undefined;
  const entries = interval === undefined ? [] : Array.isArray(interval) ? interval : [interval];
  const exitCode = launchctlText ? /last exit code = (-?\d+)/.exec(launchctlText)?.[1] : undefined;
  const runs = launchctlText ? /^\truns = (\d+)/m.exec(launchctlText)?.[1] : undefined;
  return {
    installed: plistJson !== null,
    plistPath,
    scriptPath: args.find((arg) => arg.endsWith("agent-scheduled-run.sh")) ?? args[1] ?? null,
    plistSlots: entries.map((entry) =>
      slotKey({ day: entry.Weekday !== undefined ? WEEKDAYS[entry.Weekday % 7] : null, time: `${pad(entry.Hour)}:${pad(entry.Minute)}` }),
    ),
    loaded: launchctlText !== null,
    state: launchctlText ? (/^\tstate = (.+)$/m.exec(launchctlText)?.[1] ?? null) : null,
    lastExitCode: exitCode !== undefined ? Number(exitCode) : null,
    runs: runs !== undefined ? Number(runs) : null,
  };
}
