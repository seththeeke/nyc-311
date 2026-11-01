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
  outcome: "Waiting on the forecast; Brogan won't stand anyone down before the orb has spoken.",
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
      "Backlog is down after Thursday's two hires and on-time rate is back above target, but cost per order rose with them. Fergus wants a driver released; Brogan won't release one without a forecast. Celestine will test one; the release waits on it.",
    decisions: [
      "No driver changes until the 7-day forecast is tested (Brogan, Celestine).",
      "Pothole photo uploads go back to the CPO for a cost case before the CTO scopes them.",
      "Batching stays the top engineering priority.",
    ],
    transcript: lines("2026-10-31", [
      ["12:00", "chief-of-staff", "Gooood morning, team! *ding* WBR for the week of Oct 26 is typed and filed. On-time 96.1%, backlog 41, cost per order up to $43.20. Two carried items, one new ask. Brogan, sugar, start us off."],
      ["12:01", "coo", "The weekend crew earned their keep. Brooklyn backlog went from 61 to 44 and not one SLA missed since Wednesday. Both of them stay through November."],
      ["12:02", "cfo", "And every one of those orders cost us five more coins out of the pot. $43.20 against a $38 target. Backlog at 41 means we're carrying a driver too many on weekdays."],
      ["12:03", "coo", "Backlog is at 41 BECAUSE I hired. Stand one down and we're back at 60 by Friday. I'll not trade on-time rate for a prettier line in your ledger, Fergus."],
      ["12:04", "cpo", "Neither of you can see Friday. I can, almost. Give the orb until Wednesday and I'll bring a 7-day forecast tested against October's actuals, with error bars."],
      ["12:05", "cto", "Copy. Don't build a new rig for it. The capacity model's demand curve is already in the hangar and half flight-tested. Start there."],
      ["12:06", "cpo", "Wise. Rex, where's batching? Same-block Street Condition orders were a third of last week's volume."],
      ["12:07", "cto", "Scoped. Group orders on one block that land within the hour. Kestrel takes it Monday. No cost number until it's flown in Test."],
      ["12:08", "cfo", "Now batching I like. Every batched pair is a trip that never leaves the pot."],
      ["12:10", "cpo", "A new vision from the residents: three asked to attach photos to pothole reports this week. It would spare us trips to the wrong spot."],
      ["12:11", "cto", "Photos means storage, moderation and a new public API field. That's not a Monday sortie. Bring me how many trips it saves first."],
      ["12:12", "cpo", "Fair. I'll read the warehouse instead of the stars: location-unresolved rejections and repeat visits."],
      ["12:14", "cfo", "One more: AWS is $14.80 month to date against $20, and CI is still most of it. Rex, #112 is yours."],
      ["12:15", "cto", "Pip has the stopwatch on the CDK synth step and a caching plan. Due the 7th."],
      ["12:17", "chief-of-staff", "*clack clack clack* Summary: no driver change until the forecast, photos need a cost case, batching first. Owners on every item, and I'll be checking, sweeties. Notes go out now. *ding!*"],
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
      "Both weekend drivers started and backlog is falling. Fergus flagged that the AWS forecast is well over budget, mostly CI. Rex takes CI cost; Fergus will publish a driver budget so hiring has a ceiling.",
    decisions: ["The COO hires within a weekly driver budget from the CFO, starting next week.", "CI cost is an engineering priority behind batching."],
    transcript: lines("2026-10-30", [
      ["12:00", "chief-of-staff", "Carried from yesterday: two weekend drivers (Brogan) and batching scope (Rex). Brogan, hon?"],
      ["12:01", "coo", "Both down the shaft this morning. Backlog's already 58 from 61."],
      ["12:03", "cfo", "Before anyone dances a jig: the AWS forecast for the month is $53.50 against a $20 budget. CI is 70% of it."],
      ["12:04", "cto", "That's the pipeline running every package's full suite on every push. I'll take it, but batching launches first."],
      ["12:06", "cfo", "Fine. And Brogan, I'd like a ceiling on hiring. Today it's whatever your beard tells you."],
      ["12:07", "coo", "Give me a number tied to orders, not a flat one, and I'll dig inside it."],
      ["12:09", "chief-of-staff", "Fergus owns the budget, due Saturday. Rex owns CI cost, due the 7th. *ding*"],
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
    summary: "On-time rate slipped below target with Brooklyn's backlog at 61. Brogan will hire two weekend drivers; Celestine pushed for batching as the longer-term fix, and Rex will scope it.",
    decisions: ["Hire two weekend drivers now (CEO approved).", "Scope same-block batching."],
    transcript: lines("2026-10-29", [
      ["12:00", "chief-of-staff", "Oh dear, on-time is 91.2%, under the 95% target. Brooklyn backlog is 61. Brogan?"],
      ["12:01", "coo", "We're short a crew on weekends. Two more drivers or we keep missing."],
      ["12:02", "cpo", "Or we stop sending one crew per pothole on the same block. The pattern is plain: a third of these are within 50 metres of each other."],
      ["12:04", "cto", "Batching is doable, but it's a week in the hangar at least. Won't help this weekend."],
      ["12:05", "coo", "Then I hire now, and we talk again when batching ships."],
      ["12:06", "ceo", "Approved. Hire the two, and batching is the plan to need fewer of them."],
      ["12:08", "chief-of-staff", "Brogan: two drivers by the 31st. Rex: batching scope by Nov 4. Typed, filed, *ding*."],
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
