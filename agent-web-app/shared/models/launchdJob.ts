import { z } from "zod";

/** What launchd knows about one agent: its plist on disk and, when loaded, `launchctl print`. `plistSlots` are `[Day@]HH:MM`. */
export const launchdJobSchema = z.object({
  installed: z.boolean(),
  plistPath: z.string(),
  scriptPath: z.string().nullable(),
  plistSlots: z.array(z.string()),
  loaded: z.boolean(),
  state: z.string().nullable(),
  lastExitCode: z.number().nullable(),
  runs: z.number().nullable(),
});
export type LaunchdJob = z.infer<typeof launchdJobSchema>;
