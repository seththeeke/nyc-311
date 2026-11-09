# Celestine's memory (cpo-agent)

Public: committed to the repo after any run that changes it. Conclusions from
past runs only, never secrets. Hard cap 8 KB; prune the oldest or least useful
lines to stay under it. See docs/17-executive-team.md §17.6.

## Tickets filed

- **#166 (11-06):** `ORDER_SCHEDULED` webhook event. Spec settled with Rex
  11-07 (1/2 replies used): `scheduled_start`/`scheduled_end`, both SNS
  filters, dashboard and neighbourhood/geo filter deferred. 29 contacts
  (11-09, latest: Juniper, real-time hazard-fix status).
  Track all status-visibility asks (notifications, start/end notices,
  dashboard, geo-fenced alerts, severity views) here.
- **#170 (11-07):** event-driven dispatch. Rex replied 11-07; I answered 11-08
  (1/2 used): `startTransit` race fix in scope, hourly run stays as the safety
  net. No new comments as of 11-09 19:00.
- **#181 (11-08, bug):** NYC 311 intake stall. Rex confirmed from logs (1/2
  used). 11-09 comment: worse — fixed 2,000/day since Nov 7, ~3 h of 311 time
  read per day, lag 85→99→112 h, ~450 accepted orders upstream. #72 (token)
  still open. Warned Brogan in the #181 thread not to release operators;
  Brogan confirmed (16:02) holding the 21-truck fleet, won't release on the
  shrinking visible backlog. No new comments as of 11-09 19:00.
- **#194 (11-09):** dispatch the nearest idle operator. `findIdleOperator` is
  GSI `Limit: 1`, location-blind. 3 days: actual 8.69 mi vs all-pairs 8.52
  vs nearest 3.1 mi. Expect ~180–200 paid h/wk (~$8–9k). Rex: greedy
  nearest-per-order (not a per-tick solve) — agreed. Resolved his follow-up
  (HOME_DEPOT_LOCATION fallback keeps first-available, not a distance sort).
  Spec finalized 11-09, ready for a PR. 1/2 Rex replies used.
- **#69 (backlog, not mine):** lat/lng location fallback. Commented 11-08.

## Declines (reuse the reasoning)

- Data export / analytics / historical-data API: public API
  `POST /v1/requests/search` (Ginkgo again 11-09).
- Hazard flagging/detection, photo upload, direct reporting: BoroughSim only
  ingests NYC 311 → point to 311/911. Dogwood repeats (3 more as of 11-09
  10:00 conversation).
- Accessibility audits / non-street civic issues: out of scope, use 311.
- Self-service mark-complete / feedback / live chat with crews: completion is
  crew-verified. Sassafras repeats these (but check each: some go to #166).
- Direct phone/email support: none exists; point at #170/#181/#166.
- Auto-categorise/prioritise: already exists. Single-order escalations,
  maintenance cadence: not features.

## WBR and cost model (know this)

- Goal metric = `total_cost / orders_accepted` (same week). Oct 12/19/26:
  $299/$357/$327. Nov 2 (final): $2,093 (424,872 / 203; 896 resolved during
  backlog drain, accepted depressed by #181).
- total_cost ≈ 80% materials (descriptor constant × U[1,2)). Cave-in 58% of
  materials. <$25 unreachable under this cost model; flagged to Seth 11-07.
- WBR labor = ORDER_SCHEDULED→RESOLVED (includes transit, excludes idle).
  TTR starts at ORDER_CREATED (hides 311→ingest lag, now 112 h).
- location_unresolved_rate ~0.54–0.59 every week.
- Fleet held at 21 since Nov 8 (confirmed again 11-09 16:02). Backlog
  draining fast: 259→165 (Nov 8 22:00→Nov 9 10:00), median 11.1d→9.92d.
  Brogan watching oldest order (since Nov 2); won't release on the shrinking
  visible backlog, reads 4–14/day arrivals as the #181 stall, not real
  demand drop; will reassess fleet size once Rex's intake fix lands.

## Research agenda

- **Proven → #170:** hourly dispatch. Idle 18.5–20.4% of paid h every day
  Nov 1–9 (88 h on Nov 8).
- **Proven → #181:** intake stall, worsening (see ticket line).
- **Proven → #194:** nearest-operator matching, spec finalized (see ticket
  line). Transit is 19–24% of paid h.
- **Proven → #69 (comment):** 62% of Street Condition have no BBL; ~350/wk
  recoverable via lat/lng.
- **Idea (next):** WBR measurement ticket — cohort cost (cost of orders
  accepted that week) plus paid fleet hours incl. idle. The $327→$2,093 swing
  is mostly accounting (resolved-cost / accepted-count mismatch).
- **Idea:** materials estimate biased ~33% low. Low priority.

## Saved queries (folder writes BLOCKED 11-07, 11-08, 11-09)

Writing `.claude/agent-memory/cpo-agent/queries/*.sql` fails ("sensitive
file"); asked Seth. Rebuild from these shapes:
- intake-daily: requests, STREAM rows, dt>=window; per request_id MIN
  warehouse_ingested_at / created_at; per ingest day: count, Street Condition,
  approx_percentile lag 0.5/0.9, MAX(created) = how far the feed has read.
- fleet-time-budget-daily: dedupe operator_events, LEAD next occurred_at (or
  now), class by opening event (TRANSIT_STARTED→TRANSIT, WORK_STARTED→WORKING,
  ADDED/COMPLETED/ABORTED→IDLE), shares by start day.
- nearest-operator-bounds (weekly): operator_events dt>=, 3 days only (7 days
  timed out); TRANSIT_STARTED loc + LEAD next WORK_STARTED loc per operator;
  self-join on hour tick (≥2 jobs); haversine; actual vs all-pairs avg vs
  per-job min vs per-operator min.
- street-condition-no-bbl: latest request row, 'Street Condition', 28d, by
  raw_payload address_type: no bbl / open / has latitude.

## Lessons

- **Operator event payloads have NO `$.order_id`** (query-builder
  reference.md is wrong); only `location`. Pair by operator sequence.
- Contacts cluster by persona repeating near-identical asks; still check each.
- `Edit`, `python3` unavailable; compound bash with `;`/`echo`/`head` after
  gh may be denied — run gh commands one per call. Write creates folders;
  `mkdir -p` under agent-reports can require approval even when Write doesn't.
- Top-level posts capped at 75 words, strict; aim for 65.
- Check upstream intake before reading a demand drop as real.
- Athena 20 s limit: self-joins over 7 days of operator_events time out.
- `gh issue view --comments` and `--json` are mutually exclusive; use
  `--json comments -q '.comments[-3:][]...'` to see recent replies.
- A heredoc (`cat > file << EOF`) through Bash can silently fail
  ("Parser skipped input between top-level statements"); use Write instead.
