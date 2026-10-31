import type { ActionItem, ScorecardEntry, StaffMeeting, TranscriptLine } from "../models/staffMeeting";

/*
 * Baked sample Staff Meetings (#146) for mock mode: three days of the
 * executive team arguing toward one goal, with action items carried from
 * one meeting to the next and the same scorecard every day.
 */

type ScoreValues = Record<ScorecardEntry["metric"], [number, number | null]>;

const SCORE_SHAPE: Omit<ScorecardEntry, "value" | "previous">[] = [
  { metric: "ON_TIME_RATE", label: "On-time orders", unit: "PERCENT", target: 95, better: "UP" },
  { metric: "OPEN_BACKLOG", label: "Open backlog", unit: "COUNT", target: 40, better: "DOWN" },
  { metric: "ACTIVE_DRIVERS", label: "Active drivers", unit: "COUNT", target: 12, better: "DOWN" },
  { metric: "COST_PER_ORDER", label: "Cost per resolved order", unit: "USD", target: 38, better: "DOWN" },
  { metric: "EXECUTION_FAILURE_RATE", label: "Execution failure rate", unit: "PERCENT", target: 2, better: "DOWN" },
  { metric: "AWS_SPEND_MTD", label: "AWS spend, month to date", unit: "USD", target: 20, better: "DOWN" },
  { metric: "OPEN_FEATURE_REQUESTS", label: "Open feature requests", unit: "COUNT", target: 10, better: "DOWN" },
];

function scorecard(values: ScoreValues): ScorecardEntry[] {
  return SCORE_SHAPE.map((shape) => ({ ...shape, value: values[shape.metric][0], previous: values[shape.metric][1] }));
}

function lines(date: string, entries: [string, string, string][]): TranscriptLine[] {
  return entries.map(([time, speaker_id, text]) => ({ at: `${date}T${time}:00.000Z`, speaker_id, text }));
}

const HIRE: ActionItem = {
  action_id: "AI-1029-1",
  title: "Bring on two weekend drivers for the Brooklyn backlog",
  owner_id: "coo",
  due_on: "2026-10-31",
  status: "DONE",
  raised_in: "SM-2026-10-29",
  outcome: "Two drivers active from Oct 30. Brooklyn backlog 61 → 44.",
  issue_number: null,
};

const BATCHING: ActionItem = {
  action_id: "AI-1029-2",
  title: "Scope same-block batching for Street Condition orders",
  owner_id: "cto",
  due_on: "2026-11-04",
  status: "IN_PROGRESS",
  raised_in: "SM-2026-10-29",
  outcome: null,
  issue_number: null,
};

const CI_COST: ActionItem = {
  action_id: "AI-1030-1",
  title: "Cut CI's share of the AWS bill (70% of it today, #112)",
  owner_id: "cto",
  due_on: "2026-11-07",
  status: "OPEN",
  raised_in: "SM-2026-10-30",
  outcome: null,
  issue_number: 112,
};

const BUDGET: ActionItem = {
  action_id: "AI-1030-2",
  title: "Publish a weekly driver budget the COO hires within",
  owner_id: "cfo",
  due_on: "2026-11-01",
  status: "IN_PROGRESS",
  raised_in: "SM-2026-10-30",
  outcome: null,
  issue_number: null,
};

const FORECAST: ActionItem = {
  action_id: "AI-1031-1",
  title: "Test a 7-day order forecast against last month's actuals",
  owner_id: "cpo",
  due_on: "2026-11-05",
  status: "OPEN",
  raised_in: "SM-2026-10-31",
  outcome: null,
  issue_number: null,
};

const RELEASE: ActionItem = {
  action_id: "AI-1031-2",
  title: "Release one weekday driver if backlog holds under 45 through Monday",
  owner_id: "coo",
  due_on: "2026-11-03",
  status: "BLOCKED",
  raised_in: "SM-2026-10-31",
  outcome: "Waiting on the forecast; Dee won't release before it's in.",
  issue_number: null,
};

export const MOCK_STAFF_MEETINGS: StaffMeeting[] = [
  {
    meeting_id: "SM-2026-10-31",
    held_on: "2026-10-31",
    started_at: "2026-10-31T12:00:00.000Z",
    ended_at: "2026-10-31T12:18:00.000Z",
    wbr_week: "2026-10-26",
    notes_by: "chief-of-staff",
    agenda: ["Scorecard and WBR", "Carried: batching scope, driver budget", "Whether to release a driver", "Resident feature request: pothole photo uploads"],
    summary:
      "Backlog is down after Thursday's two hires and on-time rate is back above target, but cost per order rose with them. Hal wants a driver released; Dee won't release one without a forecast. Priya will test one; the release waits on it.",
    decisions: [
      "No driver changes until the 7-day forecast is tested (Dee, Priya).",
      "Pothole photo uploads go back to the CPO for a cost case before the CTO scopes them.",
      "Batching stays the top engineering priority.",
    ],
    transcript: lines("2026-10-31", [
      ["12:00", "chief-of-staff", "Morning. WBR for the week of Oct 26 is in. On-time 96.1%, backlog 41, cost per order up to $43.20. Two carried items, one new ask. Dee, start us off."],
      ["12:01", "coo", "Weekend hires did the job. Brooklyn backlog went from 61 to 44 and we haven't missed an SLA since Wednesday. I want to keep both through November."],
      ["12:02", "cfo", "And they cost us $5 an order. We're at $43.20 against a $38 target. If backlog is at 41, we're carrying one driver too many on weekdays."],
      ["12:03", "coo", "Backlog is at 41 because I hired. Release one and we're back at 60 by Friday. I'm not trading on-time rate for a nicer cost line."],
      ["12:04", "cpo", "Neither of you knows what Friday looks like. We're guessing from last week. Give me until Wednesday and I'll have a 7-day forecast tested against October's actuals."],
      ["12:05", "cto", "We already have the capacity model's demand curve. Use that rather than building a forecaster from scratch; it's half done."],
      ["12:06", "cpo", "Good, I'll start there. Theo, where's batching? Same-block Street Condition orders are a third of last week's volume."],
      ["12:07", "cto", "Scoped. Grouping orders within one block when they land within an hour of each other. Jen picks it up Monday. I'm not promising a cost number until we've run it in Test."],
      ["12:08", "cfo", "Batching is the one that pays. Every batched pair is roughly one fewer trip."],
      ["12:10", "cpo", "New one from the residents: three asked to attach photos to pothole reports this week. It'd cut wasted trips to the wrong spot."],
      ["12:11", "cto", "Photos mean storage, moderation and a new public API field. That's not a Monday task. Bring me how many trips it saves first."],
      ["12:12", "cpo", "Fair. I'll pull the location-unresolved rejections and repeat visits from the warehouse."],
      ["12:14", "cfo", "One more: AWS is $14.80 month to date against $20. CI is still most of it. Theo, #112 is yours."],
      ["12:15", "cto", "Dex has a plan for caching the CDK synth step. Due the 7th."],
      ["12:17", "chief-of-staff", "Summary: no driver change until the forecast, photos need a cost case, batching first. Three new or carried items, owners on each. Notes go out now."],
    ]),
    action_items: [BATCHING, CI_COST, BUDGET, FORECAST, RELEASE],
    scorecard: scorecard({
      ON_TIME_RATE: [96.1, 93.4],
      OPEN_BACKLOG: [41, 58],
      ACTIVE_DRIVERS: [14, 12],
      COST_PER_ORDER: [43.2, 38.4],
      EXECUTION_FAILURE_RATE: [1.6, 1.9],
      AWS_SPEND_MTD: [14.8, 13.9],
      OPEN_FEATURE_REQUESTS: [13, 11],
    }),
  },
  {
    meeting_id: "SM-2026-10-30",
    held_on: "2026-10-30",
    started_at: "2026-10-30T12:00:00.000Z",
    ended_at: "2026-10-30T12:14:00.000Z",
    wbr_week: "2026-10-26",
    notes_by: "chief-of-staff",
    agenda: ["Scorecard", "Weekend hires: did they land?", "The AWS bill"],
    summary:
      "Both weekend drivers started and backlog is falling. Hal flagged that the AWS forecast is well over budget, mostly CI. The CTO takes CI cost; the CFO will publish a driver budget so hiring has a ceiling.",
    decisions: ["The COO hires within a weekly driver budget from the CFO, starting next week.", "CI cost is an engineering priority behind batching."],
    transcript: lines("2026-10-30", [
      ["12:00", "chief-of-staff", "Carried from yesterday: two weekend drivers (Dee) and batching scope (Theo). Dee?"],
      ["12:01", "coo", "Both started this morning. Backlog is already at 58 from 61."],
      ["12:03", "cfo", "Before we celebrate: the AWS forecast for the month is $53.50 against a $20 budget. CI is 70% of it."],
      ["12:04", "cto", "That's the pipeline running every package's full test suite on every push. I'll take it, but batching comes first."],
      ["12:06", "cfo", "Fine. And Dee, I'd like a ceiling on hiring. Today it's whatever you think we need."],
      ["12:07", "coo", "Give me a number tied to orders, not a flat one, and I'll stay inside it."],
      ["12:09", "chief-of-staff", "Hal owns the budget, due Saturday. Theo owns CI cost, due the 7th."],
    ]),
    action_items: [HIRE, BATCHING, CI_COST, BUDGET],
    scorecard: scorecard({
      ON_TIME_RATE: [93.4, 91.2],
      OPEN_BACKLOG: [58, 61],
      ACTIVE_DRIVERS: [12, 12],
      COST_PER_ORDER: [38.4, 37.9],
      EXECUTION_FAILURE_RATE: [1.9, 2.4],
      AWS_SPEND_MTD: [13.9, 13.1],
      OPEN_FEATURE_REQUESTS: [11, 11],
    }),
  },
  {
    meeting_id: "SM-2026-10-29",
    held_on: "2026-10-29",
    started_at: "2026-10-29T12:00:00.000Z",
    ended_at: "2026-10-29T12:12:00.000Z",
    wbr_week: "2026-10-26",
    notes_by: "chief-of-staff",
    agenda: ["Scorecard", "Brooklyn backlog", "Ways to need fewer drivers"],
    summary: "On-time rate slipped below target with Brooklyn's backlog at 61. Dee will hire two weekend drivers; Priya pushed for batching as the longer-term fix, and Theo will scope it.",
    decisions: ["Hire two weekend drivers now (CEO approved).", "Scope same-block batching."],
    transcript: lines("2026-10-29", [
      ["12:00", "chief-of-staff", "On-time is 91.2%, under the 95% target. Brooklyn backlog is 61. Dee?"],
      ["12:01", "coo", "We're short on weekends. I need two more drivers or we keep missing."],
      ["12:02", "cpo", "Or we stop sending one crew per pothole on the same block. A third of these are within 50 metres of each other."],
      ["12:04", "cto", "Batching is doable, but it's a week at least. It won't help this weekend."],
      ["12:05", "coo", "Then I hire now, and we revisit when batching ships."],
      ["12:06", "ceo", "Approved. Hire the two, and batching is the plan to need fewer of them."],
      ["12:08", "chief-of-staff", "Dee: two drivers by the 31st. Theo: batching scope by Nov 4."],
    ]),
    action_items: [HIRE, BATCHING],
    scorecard: scorecard({
      ON_TIME_RATE: [91.2, 92.8],
      OPEN_BACKLOG: [61, 52],
      ACTIVE_DRIVERS: [12, 12],
      COST_PER_ORDER: [37.9, 38.1],
      EXECUTION_FAILURE_RATE: [2.4, 2.1],
      AWS_SPEND_MTD: [13.1, 12.4],
      OPEN_FEATURE_REQUESTS: [11, 10],
    }),
  },
];
