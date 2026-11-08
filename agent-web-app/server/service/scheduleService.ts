import type { ScheduleSlot } from "../../shared/models/scheduleSlot.ts";

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** A slot without its mode, `[Day@]HH:MM` — the part launchd's plist records. */
export function slotKey(slot: Pick<ScheduleSlot, "day" | "time">): string {
  return slot.day ? `${slot.day}@${slot.time}` : slot.time;
}

function atSlotTime(slot: ScheduleSlot, day: Date, offsetDays: number): Date {
  const [hours, minutes] = slot.time.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + offsetDays, hours, minutes, 0, 0);
}

/** The slot's first fire strictly after `now`. */
function fireAfter(slot: ScheduleSlot, now: Date): Date {
  const step = slot.day ? 7 : 1;
  const fire = atSlotTime(slot, now, slot.day ? (WEEKDAYS.indexOf(slot.day) - now.getDay() + 7) % 7 : 0);
  return fire > now ? fire : atSlotTime(slot, fire, step);
}

/** The slot's last fire at or before `now`. */
function fireAtOrBefore(slot: ScheduleSlot, now: Date): Date {
  const step = slot.day ? 7 : 1;
  const fire = atSlotTime(slot, now, slot.day ? -((now.getDay() - WEEKDAYS.indexOf(slot.day) + 7) % 7) : 0);
  return fire <= now ? fire : atSlotTime(slot, fire, -step);
}

/** The next time any slot fires after `now`, as ISO; null for an empty schedule. */
export function nextFire(slots: ScheduleSlot[], now: Date): string | null {
  const fires = slots.map((slot) => fireAfter(slot, now).getTime());
  return fires.length > 0 ? new Date(Math.min(...fires)).toISOString() : null;
}

/** The most recent time any slot fired at or before `now`, as ISO; null for an empty schedule. */
export function previousFire(slots: ScheduleSlot[], now: Date): string | null {
  const fires = slots.map((slot) => fireAtOrBefore(slot, now).getTime());
  return fires.length > 0 ? new Date(Math.max(...fires)).toISOString() : null;
}
