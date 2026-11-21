# Celestine's memory (cpo-agent)

Public: committed to the repo after any run that changes it. Conclusions from
past runs only, never secrets. Hard cap 8 KB; prune the oldest or least useful
lines to stay under it. See docs/17-executive-team.md §17.6.

## Tickets

- **#244 (11-18, bug):** scheduled_window ends before every job finishes
  (0/1,496 inside; median 33 min late). Fix: W=2.0 multiplier via env/SSM,
  routed to Pip (not board). 2/2 Rex replies used; leave to Seth. Still
  Intake 11-20 pm: no cto-approved label (Rex's comment is feasibility only).
- **#234 (11-16):** link duplicate reports. Refined, both approved.
- **#227 (11-15):** repair feedback. Refined. 10 contacts.
- **#166 (11-06):** status visibility. Refined. 56+ contacts (+1 11-20 pm:
  estimated-completion-date ask -> same cluster). Depends #244.
- **#170 (11-07):** event-driven dispatch. Spec Created, waiting on Seth.
  11-20 evidence: 92/92 idle gaps since Nov 18 had orders waiting, 42.9 h
  idle in 2.6 d (+20%, ~$2.1k).
- **#181 (bug):** intake stall. Intake; routing waits on Seth. Don't re-ping.
- **#194:** nearest idle op. Spec Created; #202 groundwork merged (#246).
- **#213 (measurement):** idle in WBR, Option A. Refined.
- **#69, #165, #202 (not mine):** no action for me.

## Declines (reuse the reasoning)

- Data export / research / crew performance / community map or
  crowdsourced data: NYC Open Data + public search.
- Resident-contributed/crowd-sourced status updates during a repair: ours
  are operator-tracked, not resident-reported; status visibility -> #166.
- Hazard reporting / detection / apps / photo / hardware: report via 311
  (911 if danger); notify-on-fix asks go to #166.
- Route-safety maps: out of scope; fold notify part into #166.
- Mark urgent / priority / voting / resident-set priority: automatic,
  dispatch by schedule/location; every report gets a visit.
- Accessibility audits / non-street issues: out of scope.
- Self-service mark-complete / live chat / phone: none.
- Community discussion space: out of scope; point to #166 + #227.
- Feature-request dashboard / fast-track review / third-party routing: no.
- Proactive/scheduled maintenance: we only dispatch on filed 311 reports.
- Audit trail on an order: tracked under #166.
- Self-service update/photo on an order: #227 if feedback; #166 if status.
- Notification preferences / late-repair alerts / nighttime alerts /
  estimated completion date: #166.

## WBR and cost model

- Goal = total_cost / orders_accepted. Oct $299-357; Nov 2 $2,093; Nov 9
  $678; Nov 16 wk (5 days) $359 (86,815/242), materials 80%.
- **$25 goal structurally unreachable** (told Seth 11-18): materials ~$290-
  400 per order; Cave-in 56% of materials. Labor ~$48/h.
- Materials = descriptor constant x 1+U(0,1) sim factor (same factor drives
  #244). WBR labor = SCHEDULED->RESOLVED; idle excluded (#213).
- location_unresolved_rate 0.56-0.64.
- Fleet: 21 -> 4 (Nov 18) -> 3 (Nov 19 16:00) -> 5 (Nov 20 04:00, +2,
  backlog 109) -> Brogan recruiting +2 more 11-20 pm (5->7; daily median
  climbing 0.44->1.22->1.8 d; accepted outrunning resolved by 39-52/day
  since Nov 17; backlog 146, zero idle trucks). Brogan watching daily
  trend now, after my 11-20 flag; ack'd, no reply needed.

## Research agenda

- **Proven -> #170 (re-proven 11-19, 11-20), #181, #194, #213, #69,
  #227, #234, #244.**
- **Measuring: backlog-age-daily** (new 11-20): backlog eod 21 (11-17)
  -> 67 -> 116 -> 140; p90 age 45 h; resolved-day TTR p50 8.8 -> 25.7 ->
  39.8 h. Ages cluster at 2.3/8.3/16.4 h (bursty acceptance, #181).
  Watch: does +4 ops (5->7, per Brogan 11-20) and/or #170 bend it?
- **Measuring: idle share** by day: ~50% at 21 ops -> 17.6% Nov 18,
  18.3% Nov 19, 15.9% Nov 20 partial. Remaining idle = hourly-tick wait.
- **Measuring: drive share** 18-25% of paid time, 28-39 min/trip (#194).
  Work 92-110 min/job; cycle ~2.4 h/job.
- **Idea:** re-complaint after resolve 4.1%/14d: revisit when #227 ships.
- **Next:** after #213 ships, cost incl. idle; after #244, scheduled-
  window-accuracy >=98%; after #170, idle-with-backlog -> ~0. Check next
  audit whether Brogan's +2 (to 7) bends backlog growth.
- **Disproved:** materials mix as lever; poller 44h floor; 40% searches
  fail; scheduled->dispatch queue (0 h).

## Saved queries (folder writes STILL BLOCKED, sensitive-file; 11-20 too)

Shapes (rebuild from these):
- fleet-time-budget-daily: DISTINCT operator_events 30d, LEAD next (or
  now); class by opening event; exclude OPERATOR_REMOVED; by start day, 10d;
  add transit_min_per_trip, work_min_per_job, jobs_done.
- idle-with-backlog (daily): gaps = WORK_COMPLETED/ABORTED -> next event,
  since a fixed date; LEFT JOIN orders with ORDER_ACCEPTED <= gap start and
  first ORDER_DISPATCHED > gap start (or null); count gaps w/ backlog, idle
  h, p50/p90 gap min, p50 waiting.
- backlog-age-daily: per order min ACCEPTED / min RESOLVED|FAILED_TERMINAL
  (45d); days = UNNEST(sequence(current_date-10d..today)); eod = least(d+1,
  now); CROSS JOIN; count accepted/resolved by day, backlog at eod, p50/p90
  age, p50 TTR of that day's resolved.
- scheduled-window-accuracy (#244): resolved 14d, last SCHEDULED/RESOLVED
  per order; snapshot max_by(scheduled_start/end, last_event_sequence).
- materials-by-descriptor, repeat-by-descriptor (#234), order-labor-phases,
  orders-6h-blocks, resident-post-resolution-searches (#227), intake-runs
  (#181), location-unresolved-latlng (#69), resident-searches (#166).

## Lessons

- Operator event payloads have NO `$.order_id` (despite reference.md).
- public_api_calls.request_params is a plain string `order_id=<id>`.
- Satisfaction lives customer-side; never read it.
- Use Write, not Edit, sed or python; rewrite whole files. Write creates
  report folder; mkdir is blocked.
- Don't assert unmeasured facts in a ticket body; measure first.
- Top-level posts <=75 words; aim for 65.
- Check upstream intake before reading a demand drop as real.
- `gh`: one call per issue; for-loops blocked (simple_expansion).
- All gh comments show seththeeke; tell agents apart by marker.
- Repeat contact from a covered persona still gets `track_contact`.
- `list_contacts`: page once with cursor; stop at empty/null.
- A run can span a context reset: check board and latest gh comments.
- Correct a misread premise on the issue rather than just complying.
- Read the simulation code before blaming the product.
- Board has no remove command; off-board bugs stay in Intake harmlessly.
- rate() EventBridge schedules don't fire at :00; test cadence by gap
  length distribution, not minute-of-hour.
- New evidence on an existing ticket = comment, not a new ticket.
- A COO/CTO ack reply needing no response: note it, no reply needed.
- Fleet-sizing judgment is Brogan's: share signal in chat, not a ticket.
- A cto-agent "spec"/feasibility comment != cto-approved label; board
  move needs the actual label, check it before assuming ready.

## Run log

- 11-20 07:00 (audit): no new ticket; #170 evidence (92/92 gaps w/
  backlog), #166 +4 contacts; 5 contacts (4 tracked, 1 declined); 3/10
  queries; inbox empty, no Seth mentions; board unchanged, backfill done;
  CPO_DAILY 01M7WGTSV487YABXKBSSZ3B0VM, flagged lagging median to Brogan.
- 11-20 10:00 (conv): inbox empty; no new Seth/Rex comments; 0 new
  contacts; #244 still Intake (no cto-approved); 0/2 queries. No post.
- 11-20 13:00 (conv): Brogan ack'd backlog-median flag, +2 more (5->7),
  watching daily trend. No new Seth/Rex ticket comments. 2 contacts:
  nighttime-alert -> #166; crowd-sourced live-status declined. Board
  unchanged. 0/2 queries. No post.
- 11-20 19:00 (conv): inbox empty; no new Seth/Rex comments on any of
  166/170/227/234/213/181/194/244/202 (#202 is Kid Kestrel/Seth build
  thread, nothing addressed to me). 2 new contacts: estimated-completion-
  date -> #166; real-time hazard detection declined (point to 311/911).
  Board unchanged (181/244 Intake, 244 still no cto-approved). 0/2
  queries (nothing pending from Rex/Seth). No post.
