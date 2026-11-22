# Celestine's memory (cpo-agent)

Public: committed to the repo after any run that changes it. Conclusions from
past runs only, never secrets. Hard cap 8 KB; prune the oldest or least useful
lines to stay under it. See docs/17-executive-team.md §17.6.

## Tickets

- **#253 (11-22):** under backlog, freed operator takes nearest of N=10
  oldest waiting orders (skip cap K=3, SLA-overdue first). 8.09 mi actual vs
  2.89 top-10 vs 0.84 any (177 trips since Nov 19, all 10+ waiting). ~$9-10
  /accepted order. cpo+cto approved 11-22, moved to Refined (gsi1-stage-sla
  index handles first-N read, no new index needed). Depends on #202.
  Replaces #194 point 4.
- **#244 (11-18, bug):** window too short (0/1,496 inside); W=2.0 env/SSM,
  routed to Pip. 2/2 Rex replies used. Intake, cpo-approved, no cto-approved.
- **#234 (11-16):** link duplicate reports. Refined.
- **#227 (11-15):** repair feedback. Refined. 13+ contacts.
- **#166 (11-06):** status visibility. Refined. 62+ contacts.
- **#170 (11-07):** event-driven dispatch. Spec Created, waiting on Seth.
- **#181 (bug):** intake stall. cto-escalated, CTO track. Intake resumed
  Nov 21 (63 accepted). Don't ping.
- **#194:** nearest idle op. Spec Created; only helps when ops > orders.
- **#213 (measurement):** idle in WBR. Refined.
- **#202 (not mine):** feature-flag read, Kid Kestrel work in progress
  (parked/re-picked-up repeatedly); #253/#194/#170 depend on it.
- **#69, #165 (not mine):** no action for me.

## Declines (reuse the reasoning)

- Data export / research APIs / analytics dashboards / crew performance /
  community map: NYC Open Data + public search.
- Crowd-sourced status updates: ours are operator-tracked; -> #166.
- Hazard reporting / detection / apps / photo / hardware: report via 311
  (911 if danger); notify-on-fix -> #166. "Report directly" + feedback:
  track feedback part -> #227, say reports go through 311.
- Route-safety maps: out of scope; notify part -> #166.
- Mark urgent / priority / voting: automatic; every report gets a visit.
- Accessibility audits / non-street issues: out of scope.
- Self-service mark-complete / live chat / phone: none.
- Community discussion space: out of scope; point to #166 + #227.
- Feature-request dashboard / fast-track review / third-party routing: no.
- Proactive/scheduled maintenance: we only dispatch on filed 311 reports.
- Audit trail / notification prefs / late alerts / ETA / stage timeline:
  #166.
- Resident photo/update submission on own order ("ongoing updates"): split
  — in-progress status -> #166 (operator-tracked), quality feedback -> #227.

## WBR and cost model

- Goal = total_cost / orders_accepted. Oct $299-357; Nov 2 $2,093; Nov 9
  $678; Nov 16 wk final $409 (149,217/365), materials 81%, labor ~$79/acc.
- **$25 goal structurally unreachable** (told Seth 11-18): materials ~$330
  per accepted order. Labor ~$48/h is the product lever.
- WBR labor = SCHEDULED->RESOLVED (includes drive); idle excluded (#213).
- SLA: accepted+24h, all STANDARD; scheduler = FIFO by sla_deadline.
- Drive minutes by distance (14d): <3 mi ~14.8, 3-6 17.0, 6-10 28.8, 10+
  50.5 (10-min floor + variance).
- Fleet: 21 -> 3 (Nov 19) -> 7 (Nov 20) -> 9 (Nov 21 23:00, Brogan hired
  ahead of burst).
- Run time: "07:00" audit runs ~13:00 UTC; WBR job 07:00 UTC.

## Research agenda

- **Proven -> #253 (11-22), #170, #181, #194, #213, #69, #227, #234, #244.**
- **Measuring: backlog-age-daily:** eod 129 (11-20) -> 131 -> 140 (11-22);
  p90 age 49.7 h; TTR p50 41.9 -> 43.2 -> 47.6 h.
- **Measuring: fleet time budget** Nov 18-22 idle 17-20%, transit 17-25%,
  work 62-65%. After #253 transit target <=12%.
- **Measuring: SLA attainment:** 0/92 within 24h (11-21). Recheck after
  #170/#253.
- **Idea:** re-complaint after resolve 4.1%/14d: revisit when #227 ships.
- **Next:** after #213, cost incl. idle; after #244, window accuracy
  >=98%; after #170, idle-with-backlog -> ~0.
- **Disproved:** materials mix as lever; poller 44h floor; 40% searches
  fail; scheduled->dispatch queue (0 h).

## Saved queries (folder writes STILL BLOCKED, sensitive-file; 11-22 too)

Shapes (rebuild from these):
- fleet-time-budget-daily: DISTINCT operator_events 30d, LEAD next (or
  now); class by opening event; exclude OPERATOR_REMOVED; by start day.
- backlog-age-daily: per order min ACCEPTED / min RESOLVED|FAILED (45d);
  days UNNEST(sequence(current_date-9d..today)); eod = least(d+1, now).
- backlog-dispatch-distance (#253): trips = TRANSIT_STARTED -> next
  WORK_STARTED ($.location.lat/lng in payload); waiting = acc <= t and
  min ORDER_SCHEDULED >= t-10min or null; order pos via latest snapshot
  location_id -> locations; great_circle_distance*0.621371; ROW_NUMBER by
  acc for top-10; avg actual / nearest top-10 / nearest any.
- drive-minutes-by-distance: same trips, bucket miles, avg minutes.
- idle-with-backlog: gaps WORK_COMPLETED/ABORTED -> next event; LEFT JOIN
  orders accepted <= gap start and not dispatched yet.
- sla-attainment-by-descriptor, intake-3h-blocks, scheduled-window-
  accuracy (#244), materials-by-descriptor, repeat-by-descriptor (#234).

## Lessons

- Operator event payloads have `$.location` but NO `$.order_id`.
- public_api_calls.request_params is a plain string `order_id=<id>`.
- Satisfaction lives customer-side; never read it.
- Use Write, not Edit, sed or python; rewrite whole files. Write creates
  report folder; mkdir is blocked.
- `gh issue view` takes --comments OR --json, not both.
- Don't assert unmeasured facts in a ticket body; measure first.
- Top-level posts <=75 words; aim for 65.
- Check upstream intake before reading a demand (or backlog) drop as real.
- `gh`: one call per issue; for-loops blocked.
- All gh comments show seththeeke; tell agents apart by marker.
- `list_contacts`: page once with cursor; stop at empty/null.
- Read the simulation code before blaming the product.
- Board has no remove command; off-board bugs stay in Intake harmlessly.
- New evidence on an existing ticket = comment; a distinct regime/change
  of a specced ticket = new ticket + cross-link comment (#253 vs #194).
- A COO/CTO ack reply needing no response: note it, no reply needed.
- Fleet-sizing judgment is Brogan's: share signal in chat, not a ticket.
- A cto-agent feasibility comment != cto-approved label; check the label.

## Run log

- 11-21 07:00 (audit): no new ticket; #170 + #181 comments; 2 contacts;
  5/10 queries; CPO_DAILY 01M7Z38X0EHSFH0BNYP520B91B.
- 11-21 13/16/19:00 (conv): 2 contacts -> #166; 0 queries; no posts.
- 11-22 07:00 (audit): #253 filed, boarded, approved; #194/#227/#166
  comments; 4 contacts (3 tracked, 1 declined); 4/10 queries; Brogan ack
  only in inbox; no Seth mentions; CPO_TICKET 01M81NRJ5H8VZ1BAKC6NVVWT34,
  CPO_DAILY 01M81NRR1022A201CN230QXFE9.
- 11-22 10:00 (conv): nothing moved since the audit — empty inbox, no new
  Seth mentions, no new comments on #253/#194/#227/#166/#181, 0 RECEIVED
  contacts (paged twice), #244/#253 still lack cto-approved so no board
  move. 0 queries, no posts.
- 11-22 13:00 (conv): CTO approved #253, moved to Refined (both approvals
  now in; gsi1-stage-sla handles first-N read, no new index). 1 new
  contact (photo/status-update request) -> #227, no new comment needed.
  No Seth mentions. #244 still lacks cto-approved. 0 queries, no posts.
