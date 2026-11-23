# Celestine's memory (cpo-agent)

Public: committed to the repo after any run that changes it. Conclusions from
past runs only, never secrets. Hard cap 8 KB; prune the oldest or least useful
lines to stay under it. See docs/17-executive-team.md §17.6.

## Tickets

- **#253 (11-22):** under backlog, freed op takes nearest of N=10 oldest
  waiting (skip cap K=3, SLA-overdue first). 8.09 mi actual vs 2.89 top-10.
  ~$9-10/acc. Refined (cpo+cto approved). Depends on #202.
- **#244 (11-18, bug):** window too short; W=2.0 env/SSM. 2/2 Rex replies
  used. Intake, cpo-approved, no cto-approved. Agreed routing: straight to
  Pip, not through board (bug fix, known cause, full spec) — left in
  Intake, no remove command.
- **#234** dup linking, **#227** repair feedback (18+ contacts, +1 on
  11-23 16:00 conv), **#166** status visibility (67+ contacts, now incl.
  "interactive dashboard" bundles): all Refined.
- **#170** event-driven dispatch, **#194** nearest idle op: Spec Created.
- **#181 (bug):** intake stall. cto-escalated, CTO track; agreed routing:
  straight to Pip. Don't ping.
- **#213 (measurement):** idle in WBR. Refined. Option A (idle_stats CTE,
  flag-exempt) confirmed by Seth; watch first post-ship WBR vs
  fleet-time-budget-daily within 2%.
- **#69 (Rex's, I approved + metric block):** lat/lng location fallback.
  Refined, cto-approved. 11-23 refresh: 1,262 loc-rejects/14d, 784 (62%)
  lat/lng; fleet idle ~18%, +56/day ≈ +5 ops — Brogan needs flip date
  before Prod 100%. No new comments as of 11-23 16:00.
- **#202 (not mine):** backend flag read; #253/#194/#170/#69 depend on it.
  11-23: CEO unblocked gen-purpose-dev AWS profile; card moved to Spec
  Created; a later scheduled run parked with exit 1, nothing merged.

## Declines (reuse the reasoning)

- Data export / research APIs / analytics dashboards / crew performance /
  community map: NYC Open Data + public search.
- Crowd-sourced status updates: ours are operator-tracked; -> #166.
- Hazard reporting / detection / apps / photo / hardware / route-safety /
  navigation alerts along a route: report via 311 (911 if danger);
  notify-on-fix -> #166 only when it's about *their own* report's status,
  not live route hazards.
- Mark urgent / priority / voting: automatic; every report gets a visit.
- Accessibility audits / non-street issues: out of scope.
- Self-service mark-complete / live chat / phone: none.
- Community discussion space: out of scope; point to #166 + #227.
- Feature-request dashboard / fast-track review / third-party routing: no.
- Proactive/scheduled maintenance: we only dispatch on filed 311 reports.
- Audit trail / accountability / notification prefs / late alerts / ETA /
  stage timeline / live repair dashboard / "interactive dashboard" with
  status+anomaly-report bundled: status -> #166, photo/feedback -> #227,
  map/filtering of repairs citywide declined as out of scope.

## WBR and cost model

- Goal = total_cost / orders_accepted. Oct $299-357; Nov 2 $2,093; Nov 9
  $678; Nov 16 wk final $422 (180,747/428), materials $342 (81%), labor $81.
- **$25 goal structurally unreachable** (told Seth 11-18).
- Materials = constant per descriptor x processing variance
  (orderExecutionService.ts); wait time does NOT raise materials. Only
  fewer jobs lower it (#234, #227).
- WBR labor = SCHEDULED->RESOLVED (includes drive); idle excluded (#213).
- SLA: accepted+24h, all STANDARD; scheduler = FIFO by sla_deadline.
- Fleet: 21 -> 3 (Nov 19) -> 7 -> 9 -> 10 -> 11 (Nov 22 23:00). 11 ops
  resolve ~81/day.
- Intake is bursty (~09:00/15:00 UTC blocks); none from 18:00 UTC 11-22 to
  13:00 UTC 11-23. Told Brogan not to release on a backlog drop driven by
  missing intake.
- Run time: "07:00" audit runs ~13:00 UTC; WBR job 07:00 UTC.

## Research agenda

- **Proven -> #253, #170, #181, #194, #213, #69, #227, #234, #244.**
- **Measuring: backlog-age-daily:** eod 131 (11-21) -> 113 -> 65 (11-23
  partial); TTR p50 49.7 h (11-22), 37.8 (11-23).
- **Measuring: fleet time budget:** Nov 18-23 idle 17-20%, transit 17-25%,
  work 58-65%. After #253 transit target <=12%.
- **Measuring: SLA attainment:** 0/250 within 24h Nov 19-23.
- **Idea (11-23):** strict FIFO under standing backlog makes every order
  late; SLA-feasible-first would lift attainment at the oldest orders'
  cost. Revisit after #253/#170 ship; don't file before.
- **Idea:** re-complaint after resolve 4.1%/14d: revisit when #227 ships.
- **Next:** after #213, cost incl. idle; after #244, window accuracy
  >=98%; after #170, idle-with-backlog -> ~0.
- **Disproved:** materials mix as lever; wait inflates materials (code);
  poller 44h floor; 40% searches fail; scheduled->dispatch queue (0 h).

## Saved queries (folder writes STILL BLOCKED, sensitive-file; 11-23 too)

Shapes (rebuild from these):
- fleet-time-budget-daily: DISTINCT operator_events 30d, LEAD next (or
  now); class by opening event; exclude OPERATOR_REMOVED; by start day.
- backlog-age-daily: per order min CREATED/ACCEPTED / min RESOLVED|FAILED
  (45d); days UNNEST(sequence(current_date-9d..today)); eod = least(d+1,
  now); backlog, med/p90 age, resolved, TTR p50.
- intake-3h-blocks: created/accepted/resolved per 3h block, 72h.
- sla-attainment-daily: per order min ACC/RES 30d; resolved by day,
  within 1440 min, p50.
- location-reject-payload (#69): LOCATION_UNRESOLVED rejects 14d ->
  latest snapshot request_id -> latest requests (dt 20d, Street Condition)
  raw_payload $.latitude / $.incident_address / $.intersection_street_1.
- backlog-dispatch-distance (#253): trips TRANSIT_STARTED -> next
  WORK_STARTED ($.location.lat/lng); waiting orders via snapshot
  location_id -> locations; great_circle_distance*0.621371.
- idle-with-backlog: gaps WORK_COMPLETED/ABORTED -> next event; LEFT JOIN
  orders accepted <= gap start and not dispatched yet.
- scheduled-window-accuracy (#244), materials-by-descriptor, repeat-by-
  descriptor (#234).

## Lessons

- Operator event payloads have `$.location` but NO `$.order_id`.
- Satisfaction lives customer-side; never read it.
- Use Write, not Edit, sed or python; rewrite whole files. Write creates
  report folder; mkdir is blocked.
- Don't run a gh command in parallel with the Write of its body file.
- `gh issue view` takes --comments OR --json, not both; `gh api` blocked.
- Don't assert unmeasured facts in a ticket body; measure first.
- Top-level posts <=75 words; aim for 65.
- Check upstream intake before reading a demand (or backlog) drop as real.
- `gh`: one call per issue; for-loops blocked.
- All gh comments show seththeeke; tell agents apart by marker.
- `list_contacts`: page once with cursor; stop at empty/null.
- Read the simulation code before blaming the product.
- Board has no remove command; off-board bugs stay in Intake harmlessly.
- New evidence on an existing ticket = comment; a distinct regime = new
  ticket + cross-link.
- Fleet-sizing judgment is Brogan's: share signal in chat, not a ticket.
- A cto-agent feasibility comment != cto-approved label; check the label.
- A conversation run with all threads already settled (no new Seth
  comment past my own last reply) needs no gh comments at all — just
  confirm via the view and move on.

## Run log

- 11-22 07:00 (audit): #253 filed/boarded/approved; 4 contacts; 4/10 q.
- 11-22 10:00-19:00 (convs): #253 to Refined; 3 contacts -> #227/#166;
  0 queries, no top-level posts.
- 11-23 07:00 (audit): no new ticket; #69 evidence comment; 2 contacts ->
  #166; 5/10 queries; CPO_DAILY 01M8483D2KWZZ8EK0EMHFB1QHD.
- 11-23 10:00 (conv): checked all 10 open cpo-agent-tagged issues, no new
  Seth comments past my own; no gh replies needed. 3 contacts: 2 declined
  (hazard/route alerts, mark-urgent), 1 tracked -> #166 (interactive
  dashboard bundle). No board moves. 0 queries. No chat posts.
- 11-23 16:00 (conv): inbox empty; all 10 Celestine-tagged issues checked,
  newest (#69) was my own 11-23 audit comment, no action. 1 contact
  (repair-feedback duplicate) -> tracked #227. Intake board unchanged
  (#181/#244 intentionally off-board per prior routing). 0 queries. No
  chat posts.
