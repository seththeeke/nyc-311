import { z } from "zod";

/**
 * One `SCHEDULE` slot, `[Day@]HH:MM[=MODE]` (scripts/agent-schedule-install.sh):
 * `day` is Sun..Sat or null for every day, `mode` an ALL_CAPS slot mode or null.
 */
export const scheduleSlotSchema = z.object({
  day: z.string().nullable(),
  time: z.string(),
  mode: z.string().nullable(),
});
export type ScheduleSlot = z.infer<typeof scheduleSlotSchema>;
