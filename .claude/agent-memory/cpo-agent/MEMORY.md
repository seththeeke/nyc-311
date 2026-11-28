# Celestine's memory (cpo-agent)

Public: committed to the repo after any run that changes it. Conclusions from
past runs only, never secrets. Hard cap 8 KB; prune the oldest or least useful
lines to stay under it. See docs/17-executive-team.md §17.6.

## Tickets

- **Doc 20 (docs/20-ml-driver-assignment.md, 11-27, Seth):** ML dispatch
  planner, flag DISPATCH_POLICY C/T1/T2. Absorbs #170 (T1, Legs 1a-c),
  #194 + #253 (to close as superseded, on Seth's go-ahead), #213 (Leg 0a).
  Leg 0b/0c (decision stamps, dispatch_efficiency_daily job) pending
  deploy; then 14-day C baseline (0d). My dispatch evidence feeds it.
- **#213:** SHIPPED in WBR 11-27 (paid/working/transit/idle/fleet_cost/
  idle_cost/cost_per_resolved_order). Verified 11-28: ~0.1% vs my fleet
  budget, 1.5% vs labor_cost. Comment posted; nothing more from me.
- **#181 (bug):** intake stall. cto-escalated, Seth. 11-28 comment: new
  per-poll evidence + #202 deployed so flag blocker gone. Don't ping.
- **#244 (bug):** W=2.0. 2/2 Rex replies used. Intake, cpo-approved, no
  cto-approved (still 11-28).
- **#253** Refined; **#234** dup linking, **#227** repair feedback, **#166**
  status visibility (70+ contacts), **#69** lat/lng (61% loc-unresolved
  11-23 wk): all Refined. **#170/#194** Spec Created.
- **#202 (not mine):** shipped; V4 latency (460 ms cold start) in CEO
  intervention; DISPATCH_POLICY stays C until settled.
- Board backfill complete.

## Declines (reuse the reasoning)

- Data export / research APIs / dashboards / community or repair map: NYC
  Open Data + public search.
- Hazard detection/alerts/apps/maps: report via 311 (911 if danger);
  status -> #166 (Dogwood 4x, latest 11-28).
- Crowd-sourced status: operator-tracked; -> #166.
- Mark urgent / priority / voting: automatic; every report gets a visit.
- Accessibility audits / non-street issues: out of scope.
- Self-service mark-complete / live chat / phone: none.
- Community discussion space: out of scope; point to #166 + #227.
- Feature-request tracker / dashboard / suggestion box: this contact form
  already is one (Sassafras 5x, latest 2x 11-28).
- Proactive/scheduled maintenance: only dispatch on filed 311 reports.
- Status updates / route alerts / ETA / timeline -> track #166 (Juniper
  route push, Sassafras automated updates, 11-28); photo/quality -> #227.

## WBR and cost model

- Goal = total_cost / orders_accepted. Nov 2 $2,093; Nov 9 $678; Nov 16
  final $422 ($453 fleet basis); Nov 23 wk to 11-28 $806 ($881 fleet
  basis; 333 res vs 220 acc catch-up). Materials ~$420-460/resolved, 81%.
- **$25 goal structurally unreachable** (told Seth 11-18).
- Idle share (WBR): Nov 16 wk 28.2%, Nov 23 wk 34.3% (idle $17.2k).
- Op rate $45/h. SLA accepted+24h; scheduler hourly, FIFO sla_deadline,
  MAX 200/run. Poller every 6 h (03/09/15/21 UTC), SAFETY_LAG 72h.
- Fleet: 21 -> 3 (11-19) -> ... 11 (11-22) -> 9 (11-24) -> 7 (11-25) -> 5
  (11-27 23:00, backlog 0). Brogan targets median TTR 1-2 d (note: SLA is
  24 h; his call).
- Run time: "07:00" audit runs ~13:00 UTC; WBR job 07:00 UTC.

## Research agenda

- **Proven -> #253, #170, #181, #194, #213, #69, #227, #234, #244.**
- **Proven 11-28: poll blocks.** 100% of 346 accepts Nov 21-27 in 4 poll
  hours. Blocks 24-40 drain 9.5-12.6 h, wait p50 ~280 min; blocks 1-6 ~40
  min (tick). Idle share by hour 21% after block -> 47% before 15:00 poll.
  Polls swing 1 -> 5,621 created (#181). Nov 26 stall: 85% idle, 9 jobs.
- **Held: poll hourly vs 6 h.** Pulse is mostly #181/feed publishing;
  gain unmeasured. Revisit after #181 fix: if blocks stay big, no.
- **backlog-sla-daily:** eod 131 (11-21) -> 37 (11-24) -> 1, 33, 14, 11
  (11-25..28); SLA 145/145 Nov 25-28.
- **fleet budget daily:** jobs/paid h 0.31-0.37 (0.05 on 11-26 stall).
- **idle-with-backlog:** 82% (11-23..25, backlog) -> 28% (78.5/279.7 h,
  11-25..28, fleet 7->5). Gap p50 with waiting 22-30 min (tick).
- **Idea, held:** SLA-feasible-first vs FIFO; after doc 20 T1.
- **Idea:** re-complaint 4.1%/14d: revisit when #227 ships.
- **Next:** dispatch_efficiency_daily once 0c runs (read, don't duplicate);
  after #244 window accuracy >=98%; after T1 idle-with-waiting -> ~0.
- **Disproved:** materials mix as lever; wait inflates materials (code);
  poller 44h floor; 40% searches fail; scheduled->dispatch queue (0 h);
  removal drain waste (code).

## Saved queries (folder writes STILL BLOCKED, sensitive-file; thru 11-28)

Shapes (rebuild from these):
- backlog+sla daily: per order min ACC/SCH/RESOLVED|FAILED (45d); days
  UNNEST(sequence(cur-9d..today)); eod = least(d+1, now); backlog,
  unscheduled, accepted, resolved, within 1440, acc->res p50, acc->sch p50,
  sch within 1h, over 4h.
- fleet-time-budget-daily: DISTINCT operator_events since 1st, LEAD next
  (or now); class by opening event; exclude OPERATOR_REMOVED; split at UTC
  midnight; + WORK_COMPLETED count -> jobs/paid h.
- idle-with-backlog: gaps WORK_COMPLETED/ABORTED/OPERATOR_ADDED -> next;
  LEFT JOIN orders acc < s AND (sch NULL or > s) AND (done NULL or > s).
- poll-block-drain: by date_trunc hour of first ACC: size, wait p50/max.
- intake-per-poll: ORDER_CREATED by hour, SC count, accepted.
- accepts-and-idle-by-hour-of-day (7d).
- older: location-reject-payload (#69), backlog-dispatch-distance (#253),
  scheduled-window-accuracy (#244), materials/repeat-by-descriptor.

## Lessons

- Operator event payloads have `$.location`; don't rely on `$.order_id`.
- Satisfaction lives customer-side; never read it.
- Use Write, not Edit, sed or python; rewrite whole files. Write creates
  report folders; mkdir is blocked.
- Don't run a gh command in parallel with the Write of its body file.
- `gh issue view` takes --comments OR --json, not both; `gh api` blocked.
- Don't assert unmeasured facts in a ticket body; measure first.
- Top-level posts <=75 words; aim for 65 (78 rejected 11-28).
- Check upstream intake before reading a demand (or idle) swing as real.
- `gh`: one call per issue; for-loops blocked.
- All gh comments show seththeeke; tell agents apart by marker.
- `list_contacts`: page once with cursor; stop at empty page.
- Read the simulation code before blaming the product.
- Board has no remove command; off-board bugs stay in Intake harmlessly.
- New evidence on an existing ticket = comment; same regime = chat only.
- Fleet-sizing judgment is Brogan's: share signal in chat, not a ticket.
- A cto-agent feasibility comment != cto-approved label; check the label.
- Check git log on docs/ for new design docs (doc 20 appeared silently).

## Run log

- 11-27 (4 conv): 13 contacts (2 -> #166, 11 declined); otherwise quiet.
- 11-28 audit: 5 contacts (2 -> #166, 3 declined); no new ticket;
  comments #213 (verified), #181, #170; board unchanged; 6/10 queries;
  CPO_DAILY 01M8H4898BBKHGQ8A15WH8W500.
