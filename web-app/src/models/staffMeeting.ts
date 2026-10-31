import { z } from "zod";

/*
 * One daily Staff Meeting of the executive team (#146): the transcript,
 * the Chief of Staff's notes, the action items and the fixed scorecard
 * every meeting reviews. Meetings run on the Mac mini; this is the shape
 * the page needs once their notes are published.
 */

/* The same metrics every day, so the team is measured consistently. */
export const SCORECARD_METRICS = [
  "ON_TIME_RATE",
  "OPEN_BACKLOG",
  "ACTIVE_DRIVERS",
  "COST_PER_ORDER",
  "EXECUTION_FAILURE_RATE",
  "AWS_SPEND_MTD",
  "OPEN_FEATURE_REQUESTS",
] as const;
export type ScorecardMetric = (typeof SCORECARD_METRICS)[number];

export const METRIC_UNITS = ["PERCENT", "COUNT", "USD"] as const;
export type MetricUnit = (typeof METRIC_UNITS)[number];

/* Which way is good for a metric: UP for on-time rate, DOWN for cost. */
export const METRIC_DIRECTIONS = ["UP", "DOWN"] as const;

export const ScorecardEntrySchema = z.object({
  metric: z.enum(SCORECARD_METRICS),
  label: z.string().min(1),
  unit: z.enum(METRIC_UNITS),
  value: z.number(),
  previous: z.number().nullable(),
  target: z.number(),
  better: z.enum(METRIC_DIRECTIONS),
});
export type ScorecardEntry = z.infer<typeof ScorecardEntrySchema>;

export const TranscriptLineSchema = z.object({
  at: z.string().datetime(),
  speaker_id: z.string().min(1),
  text: z.string().min(1),
});
export type TranscriptLine = z.infer<typeof TranscriptLineSchema>;

export const ACTION_STATUSES = ["OPEN", "IN_PROGRESS", "DONE", "BLOCKED"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const ActionItemSchema = z.object({
  action_id: z.string().min(1),
  title: z.string().min(1),
  owner_id: z.string().min(1),
  due_on: z.string().date(),
  status: z.enum(ACTION_STATUSES),
  /* The meeting that raised it; carried items show up in later meetings too. */
  raised_in: z.string().min(1),
  outcome: z.string().nullable(),
  issue_number: z.number().int().positive().nullable(),
});
export type ActionItem = z.infer<typeof ActionItemSchema>;

export const StaffMeetingSchema = z.object({
  meeting_id: z.string().min(1),
  held_on: z.string().date(),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime(),
  /* The WBR week the team reviewed beforehand (its Monday). */
  wbr_week: z.string().date(),
  notes_by: z.string().min(1),
  agenda: z.array(z.string().min(1)),
  summary: z.string().min(1),
  decisions: z.array(z.string().min(1)),
  transcript: z.array(TranscriptLineSchema),
  action_items: z.array(ActionItemSchema),
  scorecard: z.array(ScorecardEntrySchema),
});
export type StaffMeeting = z.infer<typeof StaffMeetingSchema>;

export const StaffMeetingPageSchema = z.object({
  items: z.array(StaffMeetingSchema),
  nextCursor: z.string().nullable(),
});
export type StaffMeetingPage = z.infer<typeof StaffMeetingPageSchema>;
