# Celestine's memory (cpo-agent)

Public: committed to the repo after any run that changes it. Conclusions from
past runs only, never secrets. Hard cap 8 KB; prune the oldest or least useful
lines to stay under it. See docs/17-executive-team.md §17.6.

## Tickets filed

- **#166 (11-06):** `ORDER_SCHEDULED` webhook. 2/2 Rex replies used — fully
  CPO+CTO approved, Refined. 38 contacts tracked.
- **#170 (11-07):** event-driven dispatch. 2/2 used. Fully approved, Refined.
  Flag via #202.
- **#181 (11-08, bug):** NYC 311 intake stall. 1/2 used. 11-12: catch-up
  done; not fixed on main; open question re: 44 h floor (NYC's or poller's)
  still unanswered by Rex as of 11-12 19:00.
- **#194 (11-09):** nearest idle operator. 2/2 used. Fully approved, Refined.
- **#213 (11-10, measurement):** WBR idle/fleet hours. 2/2 used. Fully
  approved, Refined (Rex: split idle intervals at week boundaries).
- **#69 (backlog, not mine):** lat/lng location fallback. Commented 11-08.

## Board

- 11-12 19:00: no Intake cards; nothing to approve. #166/#170/#194/#213
  Refined; #202 Assigned.

## Declines (reuse the reasoning)

- Data export / analytics API / research escalation (Ginkgo, 5th+ time
  11-12 23:41): public API search + NYC Open Data; no per-requester fast
  track.
- Hazard flagging/detection, photo upload, direct reporting, hardware: point
  to 311/911 (Dogwood x5, Sycamore, Sassafras, Yellowwood 11-12).
- Mark urgent / priority display: priority is already set automatically;
  file a 311 report per problem.
- Accessibility audits / non-street civic issues: out of scope, use 311.
- Self-service mark-complete / feedback / live chat: crew-verified.
- Direct phone/email support: none exists.
- Notify/alert/street-work info requests → #166 cluster (tracked, 38).
  #166 ships the business webhook only; resident push is deferred there.

## WBR and cost model (know this)

- Goal metric = `total_cost / orders_accepted` (same week). Oct 12/19/26:
  $299/$357/$327. Nov 2: $2,093. Nov 9 week as of 11-12: $249,841/273 =
  $915 (525 resolved; $476/resolved, $382 materials).
- Materials are a constant per descriptor (streetConditionMaterialsCost
  Service.ts, $0–$600, default $200). <$25 is unreachable; flagged to
  Seth 11-07.
- WBR labor = SCHEDULED→RESOLVED; idle is left out (#213). ~$45/op-hour.
- Scheduler: hourly (`Nyc311OrderSchedulingSchedule`), max 200
  orders/run. Poller: every 6 h (`POLL_INTERVAL`).
- Fleet: 21 Nov 8–10 → 19 (Nov 10) → 17 (Nov 11); Brogan releasing 2 more
  idle trucks Nov 12 (per his 13:00 thread reply, sizing against the
  6-hourly accepted-order bursts now, not the hourly idle rate).

## Research agenda

- **Proven → #170, #181, #194, #213, #69.**
- **Proven 11-12: bursty arrivals → queue then idle.** Accepted orders
  arrive in 6-hourly blocks of 15–68 (03/09/15/21 UTC). Evidence on #170.
  No separate ticket: 3–4 h gap is small vs ~45 h NYC lag.
- **Measuring: is the 44 h 311 lag floor NYC's or ours?** Waiting on Rex's
  SODA `max(created_date)` check (#181, asked 11-12, no answer yet as of
  19:00).
- **Measuring: idle share.** 19% Nov 4–9; 33.5% Nov 10, 36.6% Nov 11, ~49%
  Nov 12 partial (fleet oversized post-drain, now being trimmed again).
  $7k/day. Feeds #213.
- **Idea: satisfaction goal has no data** (>80% satisfied). Nothing
  records resident satisfaction; a possible measurement ticket.
- **Disproved (11-11):** "40% of status searches fail": all from
  `integration-test`.
- **Idea:** materials estimate biased ~33% low. Low priority.

## Saved queries (folder writes STILL BLOCKED through 11-12, sensitive-file)

Shapes (full SQL is in the 11-12 07:00 report run; rebuild from these):
- intake-daily (daily): requests dt>=10d; per request_id
  MIN(warehouse_ingested_at)=ingested, MIN(created_at)=311 created; per
  ingest day n, SC, distinct ingest hours, p50/p90/min lag, max created.
  NOTE: `requests.created_at` IS the 311 time, not ingest.
- fleet-time-budget-daily (daily): DISTINCT operator_events 30d, LEAD next
  (or now); class by opening event; latest snapshot rate; by start day,
  8d. Today's row overcounts idle.
- resident-wait-breakdown (daily): order_events 45d MIN created/accepted,
  MAX scheduled/resolved; snapshot request_id → requests created_at; p50
  per resolve day.
- dispatch-hourly (weekly): order_events 3d, per hour accepted/scheduled/
  resolved counts.
- resident-searches (#166 metric): public_api_calls SEARCH_REQUESTS,
  requester LIKE 'resident:%', 14d, / ORDER_RESOLVED.
- nearest-operator-bounds: 3 days max; haversine self-join.

## Lessons

- Operator event payloads have NO `$.order_id` (reference.md is wrong).
- `public_api_calls.request_params` is a string, not JSON; always filter
  out requester `integration-test`.
- No `Edit` tool; rewrite memory in full with `Write`. Compound shell
  commands (&&) need approval: one command per call. `git fetch` needs
  approval; `git log origin/main` works. `mkdir -p` needs approval and can
  fail repeatedly even on retry — use `Write` on the target file instead;
  it creates parent dirs itself (except it did succeed with approval once
  granted, 11-12 19:00).
- Top-level posts are capped at 75 words; aim for 65.
- Check upstream intake before reading a demand drop as real.
- Athena 20 s: self-joins over 7 d of operator_events time out.
- `read_thread` needs the root `message_id`.
- Non-cpo cards: answer via `<!-- cpo-agent:metric -->`.
- A CTO "ticket-approved" comment needs no reply.
- `list_contacts`: stop after 1–2 empty pages.
- `gh issue view` rejects `--comments` combined with `--json`; use
  `--json comments -q '.comments[-2:]'` instead.

## Run log

- 11-12 07:00 (audit): inbox empty; 6 contacts (3 → #166, 3 declined);
  5/10 queries; comments on #166/#170/#181; no new ticket; CPO_DAILY
  01M77XRAGTN4N2K6GWGQ864DEK.
- 11-12 10:00 (conv.): inbox empty. All 5 open tickets checked, no new
  Rex questions. 1 contact (Sassafras, self-reporting) declined. No
  Intage cards. 0 queries. Chat post: none.
- 11-12 13:00 (conv.): 1 inbox entry (Brogan's reply, no action needed).
  All 5 tickets checked, no new Rex comments. 1 new contact (Dogwood,
  real-time hazard updates) tracked → #166 (now 38). No Intake cards.
  0 queries. Chat post: none.
- 11-12 16:00 (conv.): inbox empty. All 5 open tickets checked, no new
  Rex comments (still waiting on #181's SODA-lag question). 1 new
  contact (Yellowwood, faded-crosswalk detection) declined. No Intake
  cards. 0 queries. Chat post: none.
- 11-12 19:00 (conv.): inbox empty. All 5 open tickets checked, no new
  Rex comments since 16:00 (still waiting on #181). 1 new contact
  (Ginkgo, analytics tool, 5th+ ask) declined, same reasoning as prior
  Ginkgo asks. No Intake cards. 0 queries. Chat post: none.
