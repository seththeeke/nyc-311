# Celestine's memory (cpo-agent)

Public: committed to the repo after any run that changes it. Conclusions from
past runs only, never secrets. Hard cap 8 KB; prune the oldest or least useful
lines to stay under it. See docs/17-executive-team.md §17.6.

## Tickets filed

- **#166 (11-06):** `ORDER_SCHEDULED` webhook event. Spec settled with Rex
  11-07 (1/2 replies used). 32 contacts (11-10 13:00: + Sassafras repeat,
  start/end notices). NOT yet on board: backfill next audit (add metric
  block to body, then `add`).
- **#170 (11-07):** event-driven dispatch. 1/2 Rex replies used. Now has
  both cpo-approved and cto-approved labels and is in **Refined** (checked
  11-10 13:00). Flag via #202.
- **#181 (11-08, bug):** NYC 311 intake stall. 1/2 used. No new Rex activity
  as of 11-10 13:00 check; no fix on main yet.
- **#194 (11-09):** nearest idle operator. 1/2 used. Spec final, both labels
  present, **Refined** (checked 11-10 13:00). Flag via #202.
- **#213 (11-10, measurement):** WBR idle/fleet hours. Rex answered the
  open question (split idle intervals at week boundaries, matches
  `capacity_counts`); body's Open Questions updated, replied in thread
  (2/2 Rex replies used on this issue). cto-approved + cpo-approved,
  **Refined** (checked 11-10 13:00).
- **#69 (backlog, not mine):** lat/lng location fallback. Commented 11-08.

## Board

- **#202** (Seth's, backend flag read): parked by Kid Kestrel 11-10 — asked
  for a Dial-up line, baseline confirmation, and query-of-record
  confirmation (CloudWatch metric filter, not warehouse SQL, since no
  backend flag reads exist yet). Answered all three in a comment and
  finalized the body's success-metric block (dial-up: none for #202
  itself, measured during the first caller's own C→100% hold; baseline the
  20ms target against the live FeatureFlags API Lambda). Still in Intake —
  his move once his spec doc is written, not mine.
- #170, #194, #213 all confirmed in Refined as of 11-10 13:00 (no move
  needed this run).

## Declines (reuse the reasoning)

- Data export / analytics API: public API `POST /v1/requests/search` (Ginkgo).
- Hazard flagging, photo upload, direct reporting: point to 311/911
  (Dogwood repeats this; declined again 11-10).
- Accessibility audits / non-street civic issues: out of scope, use 311.
- Self-service mark-complete / feedback / live chat: crew-verified
  (Sassafras repeats; some go to #166).
- Direct phone/email support: none exists.
- Auto-categorise/prioritise: already exists. Single-order escalations,
  maintenance cadence: not features.

## WBR and cost model (know this)

- Goal metric = `total_cost / orders_accepted` (same week). Oct 12/19/26:
  $299/$357/$327. Nov 2: $2,093. Nov 9 partial (11-10): $119,349/7 = $17,050.
- Steady-state ~$540 per resolved order, ~80% materials (descriptor const ×
  U[1,2)). <$25 unreachable under this cost model; flagged to Seth 11-07.
- WBR labor = SCHEDULED→RESOLVED (transit in, idle out). Verified 11-10: paid
  fleet cost − idle = WBR labor within 1% (week Nov 2: 104.9k − 20.0k vs 84.1k).
- ~$45 per paid operator-hour. TTR starts at ORDER_CREATED (hides 311 lag).
- location_unresolved_rate ~0.53–0.59 every week.
- Fleet: 21 Nov 8–10, released to 19 on Nov 10 (backlog 40→41, most idle).

## Research agenda

- **Proven → #170:** hourly dispatch. Idle 18.0–20.2% every day Nov 1–9.
- **Proven → #181:** intake stall (see ticket line).
- **Proven → #194:** nearest-operator. Transit 19–24% of paid h.
- **Proven → #213:** WBR omits idle and mixes cohorts. Now settled with Rex
  (idle intervals split at week boundaries); job build is Rex/Kid Kestrel's.
- **Proven → #69 (comment):** 62% of Street Condition lack BBL.
- **Measuring:** idle after backlog empties: 37.6% on Nov 10. Idea: bursty
  intake (stall catch-up waves) makes fleet sizing chase noise; revisit after
  #181 lands.
- **Idea:** materials estimate biased ~33% low. Low priority.

## Saved queries (folder writes BLOCKED 11-07 through 11-10)

Writing `.claude/agent-memory/cpo-agent/queries/*.sql` fails ("sensitive
file"). Rebuild from these shapes:
- intake-daily: requests STREAM, dt>=9d; per request_id MIN ingested/created,
  MAX complaint_type; per ingest day: count, SC, p50/p90 lag, MAX(created).
- fleet-time-budget-daily: DISTINCT operator_events (dt>=30d), LEAD next
  occurred_at (or now); class by opening event (TRANSIT_STARTED, WORK_STARTED,
  ADDED/COMPLETED/ABORTED/REMOVAL_REQUESTED→IDLE, else unpaid); join latest
  snapshot rate; sum h and h×rate by start day, last 10 d. ~3 s.
- nearest-operator-bounds (weekly): 3 days only (7 timed out); TRANSIT_STARTED
  loc + LEAD WORK_STARTED loc; self-join on hour tick; haversine.
- street-condition-no-bbl: latest request row, SC, 28d, raw_payload
  address_type.

## Lessons

- **Operator event payloads have NO `$.order_id`** (reference.md wrong).
- `Edit`, `python3` unavailable; `cat a b > c` on /tmp is blocked; Write full
  bodies instead. Run gh commands one per call. `mkdir` may need approval;
  Write creates folders.
- `gh issue view --json body -q .body > /tmp/x` works to save a body.
- Top-level posts capped at 75 words; aim for 65.
- Check upstream intake before reading a demand drop as real.
- Athena 20 s limit: self-joins over 7 days of operator_events time out.
- `gh issue view --comments` and `--json` are exclusive; use
  `--json comments -q '.comments[-3:][]...'`.
- `--jq`/`-q` with a shell `for n in ...; do ... "$n" ...; done` loop in the
  Bash tool errors ("Contains simple_expansion"); run one `gh` call per
  issue number instead.
- `read_thread` needs the **thread's root `message_id`**, not the reply's
  own `message_id` from the inbox entry — passing the reply's id 404s.
- A non-cpo-agent card (e.g. #202) can be "Parked" by Kid Kestrel with
  direct questions for Celestine/Rex; answer via a
  `<!-- cpo-agent:metric -->` comment and finalize the body's block, but
  the move off Intake stays his once his spec is written.
