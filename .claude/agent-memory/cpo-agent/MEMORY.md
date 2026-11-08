# Celestine's memory (cpo-agent)

Public: committed to the repo after any run that changes it. Conclusions from
past runs only, never secrets. Hard cap 8 KB; prune the oldest or least useful
lines to stay under it. See docs/17-executive-team.md §17.6.

## Tickets filed

- **#166 (11-06):** `ORDER_SCHEDULED` webhook event. Spec settled with Rex
  on 11-07 (1/2 replies used): `scheduled_start`/`scheduled_end`, fires on
  every ORDER_SCHEDULED, both SNS filters, dashboard deferred. 26 contacts
  (as of 11-08 22:00). Track all status-visibility asks (notifications,
  dashboard, live feed, severity/priority views) here.
- **#170 (11-07):** event-driven dispatch. Rex replied 11-07; I answered 11-08
  (1/2 used): the `startTransit` race fix (IDLE check into `foldProjection`,
  TransactionCanceled = skip) is in scope and blocks the merge, hourly run
  stays as the safety net, no debounce, no FIFO. Body has a Decisions section.
  No new comments as of 11-08 22:00.
- **#181 (11-08, bug):** NYC 311 intake stall. The poller treats a short/empty
  SODA page as drained (`nyc311RequestService.ts`). Rex confirmed from poller
  logs (11-08, 1/2 replies used): empty/short pages, not timeouts/throttling.
  Plan: ship #72's token first, then tune backoff. Closed out as of 11-08
  22:00, no new comments.
- **#69 (backlog, not mine):** lat/lng location fallback. Commented with
  evidence 11-08. No reply yet. Pitch it to Seth again if it doesn't move.

## Declines (reuse the reasoning)

- Data export / analytics / "open API": the public API `POST /v1/requests/search`.
- Hazard flagging / detection, photo upload, direct reporting: BoroughSim only
  ingests NYC 311. Point residents to 311 (or 911). Dogwood repeats this
  (4th+ time declined, incl. 11-08 21:28 "third-party hazard app").
- Self-service mark-complete / satisfaction sign-off / feedback / live chat
  with crews: completion is crew-verified, no resident channel into a job.
  Sassafras repeats these near-daily (note: Sassafras's 11-08 20:45 "severity/
  impact dashboard" ask is different — tracked on #166, not declined).
- Auto-categorise/prioritise: already exists. Single-order escalations,
  maintenance cadence: not features.

## WBR and cost model (know this)

- Goal metric = `total_cost / orders_accepted` (same week). Oct 12/19/26:
  $299/$357/$327. Nov 2 partial: $1,885 (cost on 763 resolved vs 192
  accepted; accepted is depressed by the #181 intake stall).
- total_cost ≈ 80% materials (descriptor constant × U[1,2)). Cave-in is 58%
  of materials. <$25 unreachable under this cost model; flagged to Seth 11-07.
- WBR labor = ORDER_SCHEDULED→RESOLVED only (excludes idle). WBR time to
  resolve starts at ORDER_CREATED (ingestion), so it hides 311→ingest lag
  (normally ~46 h, 84–100 h since Nov 4).
- location_unresolved_rate ~0.55 every week (BBL-only resolution).
- Fleet: 5→17 (Oct 31–Nov 6), 19 on Nov 7. Backlog 940→302 (Nov 8). Median
  TTR 13.4d peak → 11.27d. Brogan still recruiting at 2/day despite falling
  accepted, correctly reading it as the intake stall not demand clearing.

## Research agenda

- **Proven → #170:** hourly dispatch. 739/739 starts at :22. Idle 18–20% of
  paid h every day Nov 1–8 (≈$16k/wk).
- **Proven → #181:** intake stall, confirmed by Rex from logs 11-08 (empty/
  short SODA pages, not timeouts). Normal 10–12.6k req/day (~220 Street
  Condition). Nov 3–8: 34,890 vs ~69k. 13/30 polls added none, 5 exactly 1,000.
- **Proven → #69 (comment):** 62% of Street Condition have no BBL
  (intersection 100%, blockface 100%). Open + has lat/lng: 1,412 in 28 days ≈
  350/wk (+70% accepted). Blockface mostly lacks lat/lng (needs geocoding).
- **Measuring:** nearest-operator matching. Transit = straight-line miles /
  25 mph, min 10 min, × variance (`transitTimeService.ts`); `findIdleOperator`
  ignores location. Last 7 days: 838 jobs, 448 transit h, avg 8.6 mi actual vs
  3.9 mi to the nearest operator dispatched in the same tick. Upper bound
  ≈40% of transit (~180 h/wk). Next: a 1:1 assignment estimate and how it
  interacts with #170 (with event dispatch, choose the nearest idle operator).
  TRANSIT_STARTED and WORK_STARTED payloads carry `location.lat/lng`.
- **Idea:** materials estimate biased ~33% low. Low priority.
- **Idea:** cohort cost metric plus paid fleet hours in the WBR (measurement ticket).

## Saved queries (folder writes BLOCKED, 11-07 and 11-08)

Writing `.claude/agent-memory/cpo-agent/queries/*.sql` fails ("sensitive
file"); asked Seth for permission. Not retried 11-08 runs (no query needed).
Rebuild from these shapes until unblocked:
- fleet-time-budget-daily: dedupe operator_events (9d), LEAD next occurred_at
  (or now), class by opening event (TRANSIT_STARTED→TRANSIT, WORK_STARTED→
  WORKING, ADDED/COMPLETED/ABORTED→IDLE), sum hours by start day.
- intake-daily: requests, STREAM rows, MIN(warehouse_ingested_at) per
  request_id = ingest time; per day count, Street Condition count, median/p90
  lag vs created_at. Per-run version: group by date_trunc('hour').
- street-condition-no-bbl: latest request row, complaint_type 'Street
  Condition', 28d; by raw_payload address_type: no bbl / open (no closed_date)
  / has latitude.
- nearest-operator: TRANSIT_STARTED followed by WORK_STARTED; haversine of start
  location → job location; self-join on hour tick for the min distance.

## Lessons

- Contacts cluster by persona repeating near-identical asks. Group by need,
  but check each new contact individually — same persona can ask something new
  (e.g. Sassafras's severity-dashboard ask on 11-08 differs from their usual
  self-service decline pattern).
- `Edit` and `python3` are unavailable; `mkdir` in a compound command needs
  approval (Write creates folders). Rewrite issue bodies with Write to /tmp.
  Reading a file written by `gh ... > /tmp/x` via Bash can fail standalone
  (wc blocked on /tmp); run the redirect alone, then Read the file directly.
- Top-level posts are capped at 75 words, and the counter is strict; aim for 65.
- Check upstream intake before reading a demand drop as real.
