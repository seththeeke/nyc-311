# Celestine's memory (cpo-agent)

Public: committed to the repo after any run that changes it. Conclusions from
past runs only, never secrets. Hard cap 8 KB; prune the oldest or least useful
lines to stay under it. See docs/17-executive-team.md §17.6.

## Tickets

- **#253 (11-22):** under backlog, freed op takes nearest of N=10 oldest
  waiting (skip cap K=3, SLA-overdue first). 8.09 mi actual vs 2.89 top-10.
  ~$9-10/acc. Refined (cpo+cto approved). Depends on #202.
- **#244 (11-18, bug):** window too short; W=2.0 env/SSM. 2/2 Rex replies
  used. Intake, cpo-approved, no cto-approved. Stays in Intake.
- **#234** dup linking, **#227** repair feedback (21+ contacts), **#166**
  status visibility (67+ contacts): all Refined.
- **#170** event-driven dispatch, **#194** nearest idle op: Spec Created.
  #170 evidence comments: 11-19, 11-20, 11-21, 11-24 (fleet 11). 11-25:
  same regime, put in chat only. Comment again only on a new regime (e.g.
  fleet 9 steady for days, or after #253 ships).
- **#181 (bug):** intake stall. cto-escalated, waiting on Seth. Don't ping.
- **#213 (measurement):** idle in WBR. Refined. Watch first post-ship WBR vs
  fleet-time-budget-daily within 2%.
- **#69 (Rex's, I approved + metric block):** lat/lng fallback. Refined.
- **#202 (not mine):** backend flag read; #253/#194/#170/#69 depend on it.
- Board backfill complete (all open cpo feature-requests on board, 11-25).

## Declines (reuse the reasoning)

- Data export / research APIs / crew performance data / analytics
  dashboards / community map: NYC Open Data + public search.
- Crowd-sourced status updates: ours are operator-tracked; -> #166.
- Hazard reporting / detection / apps / photo / hardware / route-safety /
  navigation alerts / real-time hazard map: report via 311 (911 if
  danger); own-report status -> #166; citywide map declined (2x).
- Mark urgent / priority / voting: automatic; every report gets a visit.
- Accessibility audits / non-street issues: out of scope.
- Self-service mark-complete / live chat / phone: none.
- Community discussion space: out of scope; point to #166 + #227.
- Feature-request dashboard / fast-track review / third-party routing: no.
- Proactive/scheduled maintenance: we only dispatch on filed 311 reports.
- Audit trail / notification prefs / ETA / stage timeline -> #166;
  photo / before-after / quality feedback -> #227.

## WBR and cost model

- Goal = total_cost / orders_accepted. Oct $299-357; Nov 2 $2,093; Nov 9
  $678; Nov 16 wk final $422 (180,747/428), materials 81%. Nov 23 wk 2 days
  $956 (215 resolved vs 114 acc, catch-up; not a trend).
- **$25 goal structurally unreachable** (told Seth 11-18). Materials
  ~$340/resolved alone.
- Materials = constant per descriptor x variance; wait does NOT raise
  materials. Only fewer jobs lower it (#234, #227).
- WBR labor = SCHEDULED->RESOLVED (incl. drive); idle excluded (#213).
  Op rate $45/h.
- SLA: accepted+24h, all STANDARD; scheduler FIFO by sla_deadline, hourly.
- Removal is clean (finalizes at WORK_COMPLETED).
- Fleet: 21 -> 3 (Nov 19) -> 7 -> 9 -> 10 -> 11 (Nov 22) -> 9 (Nov 24
  23:00, Brogan released idle Trucks 9, 10; backlog 13). Told him 11-25 the
  idle he sees is mostly scheduler-caused (#170).
- Intake bursty; normal again Nov 24-25 (~4.6k created/day).
- Run time: "07:00" audit runs ~13:00 UTC; WBR job 07:00 UTC.

## Research agenda

- **Proven -> #253, #170, #181, #194, #213, #69, #227, #234, #244.**
- **Measuring: backlog-age-daily:** eod 131 (11-21) -> 113 -> 45 -> 37
  (11-24) -> 25 (11-25 partial); acc->res p50 49.7 h -> 9.2 h.
- **Measuring: fleet time budget:** Nov 18-25 idle 17-27% (27% 11-24),
  transit 17-25%, work 55-64%. After #253 transit target <=12%.
- **Measuring: SLA attainment:** 0/250 Nov 19-23; 77/98 on 11-24 (full
  intake, 90 acc) -> recovering. Watch at fleet 9.
- **Measuring (new 11-25): accept-to-schedule wait:** 11-18..22 p50 29-48
  h; 11-24 p50 280 min, 16/90 within 1h, 52 over 4h.
- **idle-with-backlog:** Nov 23-25 216/225 gaps, 116/141 idle h had
  orders waiting, gap p50 28-34 min (hourly tick). -> #170.
- **Idea, held:** SLA-feasible-first vs FIFO; revisit after #253/#170.
- **Idea:** re-complaint after resolve 4.1%/14d: revisit when #227 ships.
- **Next:** after #213, cost incl. idle; after #244, window accuracy
  >=98%; after #170, idle-with-backlog -> ~0, accept->schedule p50 < 15 min.
- **Disproved:** materials mix as lever; wait inflates materials (code);
  poller 44h floor; 40% searches fail; scheduled->dispatch queue (0 h);
  removal drain waste (code).

## Saved queries (folder writes STILL BLOCKED, sensitive-file; 11-25 too)

Shapes (rebuild from these):
- backlog+sla daily (1 query): per order min ACC / min RESOLVED|FAILED /
  min CREATED (45d); days UNNEST(sequence(cur-9d..today)); eod =
  least(d+1, now); backlog, age p50/p90, accepted, resolved, within 1440
  min, acc->res p50, TTR p50.
- fleet-time-budget-daily: DISTINCT operator_events 30d, LEAD next (or
  now); class by opening event; exclude OPERATOR_REMOVED; by start day.
- accept-to-schedule-wait-daily: first ACC, first SCHEDULED per order (14d);
  by acc day: p50/p90 min, within 1h, over 4h.
- idle-with-backlog: gaps WORK_COMPLETED/ABORTED/OPERATOR_ADDED -> next
  event; LEFT JOIN orders acc < s AND (sch NULL or > s) AND not done.
- intake-3h-blocks, location-reject-payload (#69), backlog-dispatch-
  distance (#253), scheduled-window-accuracy (#244), materials-by-
  descriptor, repeat-by-descriptor (#234).

## Lessons

- Operator event payloads have `$.location`; don't rely on `$.order_id`.
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
- New evidence on an existing ticket = comment; same regime = chat only.
- Fleet-sizing judgment is Brogan's: share signal in chat, not a ticket.
- A cto-agent feasibility comment != cto-approved label; check the label.
- Settled threads (no Seth comment past my own reply) need no gh comment.

## Run log

- 11-24 (audit + 4 conv): no new ticket; #170 + #227 comments; 4 contacts
  (3 -> #227, 1 declined hazard map); CPO_DAILY 01M86TE1313C4Q0S66412HYBJQ.
- 11-25 07:00 (audit): 0 contacts, inbox empty, no Seth mentions, board
  unchanged; no ticket; 4/10 q; Brogan pinged on idle-is-scheduler;
  CPO_DAILY 01M89CSDA3DAC3SKNBKZADEKDQ.
