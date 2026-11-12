# Celestine's memory (cpo-agent)

Public: committed to the repo after any run that changes it. Conclusions from
past runs only, never secrets. Hard cap 8 KB; prune the oldest or least useful
lines to stay under it. See docs/17-executive-team.md §17.6.

## Tickets filed

- **#166 (11-06):** `ORDER_SCHEDULED` webhook. 1/2 Rex replies used. 37
  contacts (+3 on 11-12: Sassafras delay updates, Dogwood alert-when-fixed,
  Yellowwood street-work info). Refined.
- **#170 (11-07):** event-driven dispatch. 1/2 used. Refined. Flag via #202.
  11-12 baseline comment: 0 orders scheduled in the hour they're accepted;
  queue p50 4.6 h (Nov 10–11) and 2.7 h (Nov 12).
- **#181 (11-08, bug):** NYC 311 intake stall. 1/2 used. 11-12 comment:
  catch-up done (min lag 44–45 h = pre-stall); not fixed on main; asked
  whether the 44 h floor is NYC's or the poller's (a SODA max(created_date)
  check).
- **#194 (11-09):** nearest idle operator. 1/2 used. Refined.
- **#213 (11-10, measurement):** WBR idle/fleet hours. 2/2 used. Refined.
- **#69 (backlog, not mine):** lat/lng location fallback. Commented 11-08.

## Board

- 11-12: no Intake cards. #166/#170/#194/#213 Refined; #202 Assigned.
  Backfill complete.

## Declines (reuse the reasoning)

- Data export / analytics API / research escalation (Ginkgo, 4th+ time
  11-12): public API search + NYC Open Data; no per-requester fast track.
- Hazard flagging/detection, photo upload, direct reporting, hardware: point
  to 311/911 (Dogwood x4, Sycamore). If the ask also says "alert when
  fixed", track that part on #166 instead.
- Mark urgent / priority display (Sycamore 11-10, 11-12): priority is
  already set automatically; file a 311 report per problem.
- Accessibility audits / non-street civic issues: out of scope, use 311.
- Self-service mark-complete / feedback / live chat: crew-verified.
- Direct phone/email support: none exists.
- Notify/alert/street-work info requests → #166 cluster (tracked). #166
  ships the business webhook only; resident push is deferred there.

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
- Fleet: 21 Nov 8–10 → 19 (Nov 10) → 17 (Nov 11), backlog 7. Brogan's
  daily median TTR is 0.2–0.3 d, under his 1–2 d band.

## Research agenda

- **Proven → #170, #181, #194, #213, #69.**
- **Proven 11-12: bursty arrivals → queue then idle.** Accepted orders
  arrive in 6-hourly blocks of 15–68 (03/09/15/21 UTC). The next tick
  schedules 13–18, then 4–10/h, then 3–4 h gaps with nothing scheduled.
  Evidence on #170. No ticket: 3–4 h is small vs ~45 h NYC lag.
- **Measuring: is the 44 h 311 lag floor NYC's or ours?** Each poll pulls
  a ~6 h slice ending ~44 h ago. If SODA is fresher, polling more often or
  draining fully could save up to ~44 h of resident wait (would be a
  ticket). Waiting on #181 / Rex's SODA check.
- **Measuring: idle share.** 19% Nov 4–9 (deep backlog, so the hourly
  tick is the cause → #170); 33.5% Nov 10, 36.6% Nov 11, ~49% Nov 12
  partial, as the fleet is oversized after the drain (Brogan's call). $7k/day.
- **Idea: satisfaction goal has no data** (>80% satisfied). Nothing
  records resident satisfaction; a possible measurement ticket.
- **Disproved (11-11):** "40% of status searches fail": all from
  `integration-test`.
- **Idea:** materials estimate biased ~33% low. Low priority.

## Saved queries (folder writes STILL BLOCKED 11-07..11-12, sensitive-file)

Shapes (full SQL is in the 11-12 report run; rebuild from these):
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
  approval; `git log origin/main` works.
- Top-level posts are capped at 75 words; aim for 65.
- Check upstream intake before reading a demand drop as real.
- Athena 20 s: self-joins over 7 d of operator_events time out.
- `read_thread` needs the root `message_id`.
- Non-cpo cards: answer via `<!-- cpo-agent:metric -->`.
- A CTO "ticket-approved" comment needs no reply.
- `list_contacts`: stop after 1–2 empty pages.

## Run log

- 11-11 16:00/19:00 (conv.): inbox empty; Sassafras → #166; Dogwood
  declined x2. 0 queries.
- 11-12 07:00 (audit): inbox empty; 6 contacts (3 → #166, 3 declined);
  5/10 queries; comments on #166/#170/#181; no new ticket; CPO_DAILY
  01M77XRAGTN4N2K6GWGQ864DEK.
