import { CEO_ID } from "./teamRoster";

/*
 * Recent contributions per team member (#146), shown in the secondary
 * workspace from Meet the Team. Fixed demo content until the agents
 * report their own actions: each is something they did, why, and a link
 * when there's something to open.
 */

export const CONTRIBUTION_KINDS = ["CAPACITY", "PULL_REQUEST", "ISSUE", "BUDGET", "DECISION", "MEETING", "REVIEW"] as const;
export type ContributionKind = (typeof CONTRIBUTION_KINDS)[number];

export interface Contribution {
  contribution_id: string;
  member_id: string;
  at: string;
  kind: ContributionKind;
  title: string;
  /* Why they did it, in a line. */
  detail: string;
  link: string | null;
}

export const CONTRIBUTION_LABEL: Record<ContributionKind, string> = {
  CAPACITY: "Capacity",
  PULL_REQUEST: "Pull request",
  ISSUE: "Issue",
  BUDGET: "Budget",
  DECISION: "Decision",
  MEETING: "Meeting",
  REVIEW: "Review",
};

const REPO = "https://github.com/seththeeke/nyc-311";

function did(id: string, member_id: string, at: string, kind: ContributionKind, title: string, detail: string, link: string | null = null): Contribution {
  return { contribution_id: id, member_id, at: `${at}:00.000Z`, kind, title, detail, link };
}

export const TEAM_CONTRIBUTIONS: readonly Contribution[] = [
  did("C1", CEO_ID, "2026-10-31T08:40", "DECISION", "Asked for Team Chat as an exec demo", "See how the agents would talk on Slack before wiring it up.", `${REPO}/issues/150`),
  did("C2", CEO_ID, "2026-10-30T08:12", "BUDGET", "Approved two weekend drivers", "Brooklyn backlog was 61 against a target of 40."),
  did("C3", "chief-of-staff", "2026-10-31T08:31", "MEETING", "Published the Oct 31 Staff Meeting minutes", "4 decisions, 5 action items, every one with an owner and a date."),
  did("C4", "chief-of-staff", "2026-10-30T17:00", "REVIEW", "Chased two overdue action items", "Batching scope and the driver forecast were both a day late."),
  did("C5", "coo", "2026-10-31T09:05", "CAPACITY", "Added 2 operators in Brooklyn", "Median time to resolve hit 2.4 days, over the 2-day ceiling."),
  did("C6", "coo", "2026-10-29T18:20", "CAPACITY", "Released 1 operator in Staten Island", "Queue empty for 3 days and resolution under 1 day: paying for idle time."),
  did("C7", "coo", "2026-10-28T10:00", "DECISION", "Moved two crews to night shifts", "Overnight requests were waiting 14 hours for the morning crew."),
  did("C8", "cpo", "2026-10-31T11:15", "ISSUE", "Filed: batch same-block repairs", "A third of pothole orders are within 50 m of another open order.", `${REPO}/issues/146`),
  did("C9", "cpo", "2026-10-30T15:40", "DECISION", "Declined resident idea: SMS updates", "Lots of interest, but it adds cost per order without cutting work."),
  did("C10", "cfo", "2026-10-31T07:50", "BUDGET", "Flagged AWS spend at 82% of budget", "Lambda concurrency from the ingestion backfill; asked the CTO to cap it."),
  did("C11", "cfo", "2026-10-29T16:30", "BUDGET", "Signed off the weekend driver spend", "Two drivers cost less than the SLA credits a missed weekend would."),
  did("C12", "cto", "2026-10-30T14:10", "REVIEW", "Approved the resident ideas feed fix", "Blank follow-ups broke the feed; the fix stores them as null.", `${REPO}/issues/147`),
  did("C13", "cto", "2026-10-30T09:20", "DECISION", "Approved the synth test speedup", "66 s per run was slowing every PR in the pipeline."),
  did("C14", "devx", "2026-10-30T16:30", "PULL_REQUEST", "Cut the stack synth test from 66 s to 5.5 s", "Cached the Lambda bundling between test cases.", `${REPO}/pulls`),
  did("C15", "devx", "2026-10-29T11:00", "ISSUE", "Filed: flaky map smoke test", "Failed 3 of the last 20 runs on a tile timeout.", `${REPO}/issues`),
  did("C16", "gen-dev", "2026-10-30T13:45", "PULL_REQUEST", "Fixed the resident ideas feed 400", "Blank follow-ups now store as null and the feed parses again.", `${REPO}/pulls`),
  did("C17", "gen-dev", "2026-10-31T09:00", "PULL_REQUEST", "Team Chat channel list and message view", "Frontend demo for #150: two channels, read-only.", `${REPO}/issues/150`),
];

/** A member's contributions, newest first. */
export function contributionsFor(memberId: string): Contribution[] {
  return TEAM_CONTRIBUTIONS.filter((item) => item.member_id === memberId).sort((a, b) => b.at.localeCompare(a.at));
}
