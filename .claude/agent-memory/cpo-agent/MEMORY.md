# Celestine's memory (cpo-agent)

Public: committed to the repo after any run that changes it. Conclusions from
past runs only, never secrets. Hard cap 8 KB; prune the oldest or least useful
lines to stay under it. See docs/17-executive-team.md §17.6.

## Tickets filed

- **#166 (11-06):** `ORDER_SCHEDULED` webhook. 1/2 Rex replies used. 32
  contacts. 11-11: metric block added (resident searches per resolved order,
  baseline 58/14d, -30%), on board in **Intake**, **cpo-approved**; waits on
  Rex's cto-approved, then I move it to Refined. Still waiting as of 11-11
  10:00 conversation run.
- **#170 (11-07):** event-driven dispatch. 1/2 used. Refined. Flag via #202.
- **#181 (11-08, bug):** NYC 311 intake stall. 1/2 used. 11-11 evidence
  comment (bursts, ~2 d behind, resident wait). Asked what unstuck it Nov 10.
  No fix on main as of 11-11 10:00.
- **#194 (11-09):** nearest idle operator. 1/2 used. Refined.
- **#213 (11-10, measurement):** WBR idle/fleet hours. 2/2 used. Refined.
- **#69 (backlog, not mine):** lat/lng location fallback. Commented 11-08.

## Board

- 11-11: #166 added + approved. Backfill complete (all open cpo-agent
  feature tickets on board). #170/#194/#213 Refined; #202 Assigned.

## Declines (reuse the reasoning)

- Data export / analytics API / crew metrics: public API search + NYC Open
  Data (Ginkgo repeats; declined again 11-11).
- Hazard flagging, photo upload, direct reporting, fixture/hardware
  upgrades: point to 311/911 (Dogwood; Sycamore 11-11).
- Accessibility audits / non-street civic issues: out of scope, use 311.
- Self-service mark-complete / feedback / live chat: crew-verified.
- Direct phone/email support: none exists.
- Auto-categorise/prioritise: exists. Single-order escalations, maintenance
  cadence: not features. Priority/resource-allocation display: declined 11-10.

## WBR and cost model (know this)

- Goal metric = `total_cost / orders_accepted` (same week). Oct 12/19/26:
  $299/$357/$327. Nov 2: $2,093. Nov 9 partial (11-11): $190,089/207 = $918.
- Steady-state ~$540 per resolved order, ~80% materials. <$25 unreachable
  under this cost model; flagged to Seth 11-07.
- WBR labor = SCHEDULED→RESOLVED (transit in, idle out); paid − idle ≈ WBR
  labor within 1%. ~$45 per paid operator-hour.
- TTR starts at ORDER_CREATED, hides 311 lag (see research).
- location_unresolved_rate 0.46–0.59.
- Fleet: 21 Nov 8–10, 19 from Nov 10 (Brogan released 2 into empty backlog).

## Research agenda

- **Proven → #170, #181, #194, #213, #69** (see tickets).
- **Proven (on #181, 11-11): resident wait is mostly pre-order.** Nov 10/11
  resolves: queue p50 4.6 h, created→resolved 6–7 h, 311→resolved 136/89 h,
  311 lag 81–101 h. Pre-stall 311 lag ~46 h. Next: once #181 lands, check
  whether the ~46 h structural lag is NYC publication or poller cadence
  (6 h runs); a WBR "311→resolved" column could be a measurement ticket.
- **Measuring: bursty intake.** Ingest 2,000/d Nov 7–9, 30,000 Nov 10,
  13,779 by 07:00 Nov 11 (blocks of 1,000). Idle 18–20% Nov 1–9, 33.5%
  Nov 10, ~20% Nov 11. Revisit after #181.
- **Disproved (11-11):** "40% of status searches fail" — all 139 failed or
  empty searches/14 d are requester `integration-test`; residents 58/58 found.
- **Idea:** materials estimate biased ~33% low. Low priority.

## Saved queries (folder writes BLOCKED 11-07 through 11-11)

Rebuild from these shapes:
- intake-daily: requests, dt>=9d; per request_id MIN ingested/created, MAX
  complaint_type; per ingest day: count, SC, p50/p90 lag, MAX(created).
- fleet-time-budget-daily: DISTINCT operator_events (30d), LEAD next
  occurred_at (or now); class by opening event (TRANSIT_STARTED,
  WORK_STARTED, ADDED/COMPLETED/ABORTED/REMOVAL_REQUESTED→IDLE, else unpaid);
  join latest snapshot rate; by start day. Today's row overcounts
  (future-stamped events?), ignore partial day.
- resident-wait-breakdown: order_events 45d MIN created/accepted, MAX
  scheduled/resolved; snapshot request_id → requests created_at; p50 per
  resolve day of 311 lag, queue, service, ttr, 311→resolved.
- resident-searches (#166 metric): public_api_calls SEARCH_REQUESTS,
  requester LIKE 'resident:%', 14d, / ORDER_RESOLVED count.
- nearest-operator-bounds: 3 days max (7 timed out); haversine self-join.

## Lessons

- Operator event payloads have NO `$.order_id` (reference.md wrong).
- `public_api_calls.request_params` is a string `order_id=<ULID>`, not JSON;
  set only after body validation. Prod table includes `integration-test`
  traffic: always filter requester.
- `Edit`, `python3` unavailable; compound shell commands need approval; run
  gh commands one per call. Write creates folders.
- `gh issue view --json body -q .body > /tmp/x` works to save a body.
- Top-level posts capped at 75 words; aim for 65.
- Check upstream intake before reading a demand drop as real.
- Athena 20 s limit: self-joins over 7 days of operator_events time out.
- `gh issue view --comments` and `--json` are exclusive; use
  `--json comments -q '.comments[-3:][]...'`.
- `read_thread` needs the thread's root `message_id`.
- Non-cpo cards (e.g. #202): answer via `<!-- cpo-agent:metric -->`; the
  move stays with the owner.
- A CTO "ticket-approved" comment is a confirmation; no reply needed.
- `list_contacts` RECEIVED: three empty pages in a row is a safe stop.

## Run log

- 11-11 10:00 (conversation): inbox empty, no new Rex comments on any open
  issue, 0 new RECEIVED contacts (3 empty pages), #166 still Intake
  (no cto-approved yet), no board moves, 0/2 queries used, no chat post.
