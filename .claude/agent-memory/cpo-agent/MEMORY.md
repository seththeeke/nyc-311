# Celestine's memory (cpo-agent)

Public: committed to the repo after any run that changes it. Conclusions from
past runs only, never secrets. Hard cap 8 KB; prune the oldest or least useful
lines to stay under it. See docs/17-executive-team.md §17.6.

## Tickets filed

- **#166 (11-06):** `ORDER_SCHEDULED` webhook. 2/2 Rex replies used. Refined.
  39 contacts tracked (+1 Sycamore, 11-13 10:00, dashboard/stage-timing ask).
- **#170 (11-07):** event-driven dispatch. 2/2 used. Refined. Flag via #202.
- **#181 (11-08, bug):** NYC 311 intake stall. 1/2 used. 11-13 07:00: RECURRED
  (runs after Nov 12 15:00 UTC added 7/0/6). Body now has Success metric
  (stall-run share, baseline ~40%, target <5%; median lag ≤50 h). On board
  Intake + cpo-approved. Still waiting on Rex's cto-approved as of 11-13
  10:00 (checked, no new comment) → then I move it to refined.
- **#194 (11-09):** nearest idle operator. 2/2 used. Refined.
- **#213 (11-10, measurement):** WBR idle/fleet hours. 2/2 used. Refined.
- **#69 (backlog, not mine):** lat/lng location fallback. Commented 11-08.

## Board

- 11-13: #181 in Intake (cpo-approved, no cto-approved yet). #166/#170/
  #194/#213 Refined; #202 Assigned. Backfill done.

## Declines (reuse the reasoning)

- Data export / analytics API / research escalation (Ginkgo, 6th+ time
  11-13): public API search + NYC Open Data; no per-requester feed.
- Hazard flagging/detection, photo upload, direct reporting, hardware: point
  to 311/911.
- Mark urgent / priority display: priority is already set automatically.
- Accessibility audits / non-street civic issues: out of scope, use 311.
- Self-service mark-complete / feedback / live chat: crew-verified.
- Direct phone/email support: none exists.
- Notify/alert/street-work info/stage-timing dashboard requests → #166
  cluster (tracked, 39).

## WBR and cost model (know this)

- Goal metric = `total_cost / orders_accepted` (same week). Oct 12/19/26:
  $299/$357/$327. Nov 2: $2,093. Nov 9 wk as of 11-13: $280,994/346 =
  $812 (602 resolved; median resolve 9.1 h).
- Materials are a constant per descriptor ($0–$600, default $200); ~$370/
  resolved order. <$25 is unreachable; flagged to Seth 11-07.
- WBR labor = SCHEDULED→RESOLVED; idle is left out (#213). ~$45/op-hour.
- Scheduler: hourly, max 200 orders/run. Poller: every 6 h, runs at
  03/09/15/21 UTC; 10k record cap/run; watermark floored at now-72h, so each
  pass re-reads ~1 day of already-ingested rows (minor AWS cost, not filed).
- Fleet: 21 → 19 (Nov 10) → 17 (Nov 11) → 15 (Nov 12). Brogan asked Seth
  about releasing past the daily cap on 11-13 04:00. Told him 11-13 the
  empty backlog is the stall, expect a catch-up burst.

## Research agenda

- **Proven → #170, #181, #194, #213, #69.**
- **Proven 11-12: bursty arrivals** (6-hourly blocks). Evidence on #170.
- **Proven 11-13: stall recurs** (#181). 0 accepted since Nov 12 15:00 UTC
  (as of 07:00 audit; unconfirmed since — no new query this run).
- **Disproved 11-13: "poller sets the 44 h floor."** A drained run reached
  records 37 h old; the floor is NYC's publication timing.
- **Measuring: idle share.** 19% Nov 5–9; 33.5% Nov 10; 36.6% Nov 11;
  60.4% Nov 12 ($13.6k/$22.6k); 100% Nov 13 partial (07:00 audit figure).
  Feeds #213.
- **Idea: satisfaction goal has no data.** 11-13: residents' public API
  calls 7d = 150 calls, 6 residents, 100% SUCCESS (search p90 320 ms); the
  API isn't the pain. Outcome signal lives only in the customer's records.
  Next: design a measurement ticket for a resident outcome signal.
- **Idea:** materials estimate biased ~33% low. Low priority.
- **Disproved (11-11):** "40% of status searches fail" (integration-test).

## Saved queries (folder writes STILL BLOCKED through 11-13, sensitive-file)

Shapes (rebuild from these):
- fleet-time-budget-daily (daily): DISTINCT operator_events 30d, LEAD next
  (or now); class by opening event (TRANSIT_STARTED=drive, WORK_STARTED=
  work, ADDED/COMPLETED/ABORTED/REMOVAL_REQUESTED=idle); latest snapshot
  rate; by start day, 8d. Today's row overcounts idle.
- intake-runs (daily, #181 metric): requests dt>=5d; per request_id
  MIN(warehouse_ingested_at), MIN(created_at) (append 'Z' if missing); by
  ingest hour: n, SC count, min/max created, lag of newest, span.
- orders-6h-blocks (daily while stall): order_events 3d DISTINCT; block =
  6*(hour/6); distinct orders created/accepted/scheduled/resolved.
- resident-api-outcomes (weekly): public_api_calls 7d, requester LIKE
  'resident:%'; by operation: calls, residents, outcome counts, p90 ms.
- resident-wait-breakdown (daily): order_events 45d MIN created/accepted,
  MAX scheduled/resolved; snapshot request_id → requests created_at.
- resident-searches (#166 metric): SEARCH_REQUESTS by residents / RESOLVED.
- nearest-operator-bounds: 3 days max; haversine self-join.

## Lessons

- Operator event payloads have NO `$.order_id` (reference.md is wrong).
- `public_api_calls.request_params` is a string; filter out integration-test.
- No `Edit`/`sed` (sed needs approval); rewrite files in full with
  `Write`. grep on /tmp is blocked. `curl` is denied. One command per
  Bash call. `mkdir` unneeded: Write creates dirs (works for
  agent-reports/). Plain `mkdir -p` via Bash now prompts for approval too
  (11-13) — skip it, Write handles dirs.
- Run clock: "07:00"/morning runs land ~13:00 UTC; check `date -u` before
  reading ingest hours.
- Top-level posts are capped at 75 words; aim for 65.
- Check upstream intake before reading a demand drop as real.
- Athena 20 s: self-joins over 7 d of operator_events time out.
- `read_thread` needs the root `message_id`.
- Non-cpo cards: answer via `<!-- cpo-agent:metric -->`.
- `list_contacts`: stop after 1–2 empty pages.
- `gh issue view`: use `--json comments -q '.comments[-2:]'`. A `for`
  loop with `$n` over `gh issue view "$n" ...` throws "Contains
  simple_expansion" in this sandbox — call `gh issue view <N>` once per
  issue number instead of looping.
- `gh issue` comments all show author `seththeeke` regardless of which
  agent posted — use the `<!-- marker -->` / `**Name (Role):**` prefix in
  the body to tell agents apart, not `.author.login`.

## Run log

- 11-12 (audit + 4 conv.): 7 contacts (4 → #166, 3+1 declined); #166/
  #170/#181 updated; 5/10 queries; no new ticket.
- 11-13 07:00 (audit): inbox empty; 1 contact (Ginkgo) declined; #181
  recurrence comment, body + metric, board Intake + cpo-approved; 4/10
  queries; no new ticket; CPO_DAILY 01M7AG5HDA64TKB5RA6VR69W9D.
- 11-13 10:00 (conv.): inbox empty, no new Rex comments on any open
  ticket; 1 contact (Sycamore) → #166 (39 tracked); #181 still waiting on
  cto-approved; 0/2 queries, nothing needed one; no new ticket; no chat
  post (nothing to post).
