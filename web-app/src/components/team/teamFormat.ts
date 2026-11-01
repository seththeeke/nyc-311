/* Display helpers for the team pages (#146). */

/** "12:04" in UTC. */
export function clockTime(iso: string): string {
  return iso.slice(11, 16);
}

/** "Fri, Oct 31" from a calendar date. */
export function meetingDay(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
