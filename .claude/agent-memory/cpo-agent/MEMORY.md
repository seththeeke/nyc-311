# Celestine's memory (cpo-agent)

Public: committed to the repo after any run that changes it. Conclusions from
past runs only, never secrets. Hard cap 8 KB; prune the oldest or least useful
lines to stay under it. See docs/17-executive-team.md §17.6.

## Tickets

- **#244 (11-18, bug):** scheduled_window ends before every job finishes
  (0/1,496 inside). Fix: W=2.0 multiplier via env/SSM, routed to Pip (not
  board). 2/2 Rex replies used. Still Intake 11-21: no cto-approved.
- **#234 (11-16):** link duplicate reports. Refined, both approved.
- **#227 (11-15):** repair feedback. Refined. 10 contacts.
- **#166 (11-06):** status visibility. Refined. 59+ contacts (11-21 16:00:
  +1, construction-site-reopening-for-route-planning tracked here too).
- **#170 (11-07):** event-driven dispatch. Spec Created, waiting on Seth.
  11-21 evidence: 79/79 idle gaps since Nov 20 had orders waiting (p50
  119), 40.3 idle h in ~37 h (~1 of 7 ops); 0/92 within 24h SLA last 2d.
- **#181 (bug):** intake stall. Intake; waits on Seth. 11-21 comment: 3
  orders created in 21 h after Nov 20 15:43 (bursts 2.5-3.9k). Don't ping.
- **#194:** nearest idle op. Spec Created; #202 groundwork merged (#246).
- **#213 (measurement):** idle in WBR, Option A. Refined.
- **#69, #165, #202 (not mine):** no action for me.

## Declines (reuse the reasoning)

- Data export / research / analytics dashboards / crew performance /
  community map: NYC Open Data + public search.
- Crowd-sourced status updates: ours are operator-tracked; -> #166.
- Hazard reporting / detection / apps / photo / hardware: report via 311
  (911 if danger); notify-on-fix (incl. on my route) -> #166.
- Route-safety maps: out of scope; fold notify part into #166 (incl.
  construction-site-reopening asks for route planning, 11-21).
- Mark urgent / priority / voting: automatic; every report gets a visit.
- Accessibility audits / non-street issues: out of scope.
- Self-service mark-complete / live chat / phone: none.
- Community discussion space: out of scope; point to #166 + #227.
- Feature-request dashboard / fast-track review / third-party routing: no.
- Proactive/scheduled maintenance: we only dispatch on filed 311 reports.
- Audit trail / notification prefs (incl. by type/severity) / late
  alerts / ETA date: #166.
- Self-service update/photo on an order: #227 if feedback; #166 if status.

## WBR and cost model

- Goal = total_cost / orders_accepted. Oct $299-357; Nov 2 $2,093; Nov 9
  $678; Nov 16 wk (6 days) $373 (112,620/302), materials 80%.
- **$25 goal structurally unreachable** (told Seth 11-18): materials ~$290-
  400 per order; Cave-in 56% of materials. Labor ~$48/h.
- Materials = descriptor constant x 1+U(0,1) sim factor. WBR labor =
  SCHEDULED->RESOLVED; idle excluded (#213).
- SLA: MockOrderPriorityAssigner = accepted+24h, all STANDARD; scheduler
  takes oldest sla_deadline first = FIFO by acceptance, any hazard.
- Fleet: 21 -> 4 (Nov 18) -> 3 -> 5 (Nov 20 04:00) -> 7 (Nov 20 16:00);
  held 7 at 23:00, backlog 113. Told Brogan 11-21 the drain is intake
  stall, expect a jump on next burst.
- Run time: "07:00" audit runs ~13:00 UTC; WBR job 07:00 UTC.

## Research agenda

- **Proven -> #170 (re-proven 11-19/20/21), #181, #194, #213, #69,
  #227, #234, #244.**
- **Measuring: SLA attainment** (new 11-21): 7d ~67% within 24h; last 2d
  0/92. Cave-in 29% of resolves, p50 10.6h same as others (FIFO). Severity
  tiering only reshuffles who waits; need satisfaction-by-descriptor
  evidence before a ticket. Watch after #170.
- **Measuring: backlog-age-daily:** eod 21 (11-17) -> 67 -> 116 -> 129
  (11-20) -> 97 (11-21 13:00, intake stalled); p90 age 39 h; resolved-day
  TTR p50 8.8 -> 25.7 -> 41.9 -> 39.1 h.
- **Measuring: idle share** ~50% at 21 ops -> 17.6/18.3/18.0/21.6% Nov
  18-21 with backlog. Remaining idle = hourly-tick wait (gap p50 32 min).
- **Measuring: drive share** 18-25% of paid time, 29-39 min/trip (#194).
  Work 92-108 min/job.
- **Idea:** re-complaint after resolve 4.1%/14d: revisit when #227 ships.
- **Next:** after #213, cost incl. idle; after #244, window accuracy
  >=98%; after #170, idle-with-backlog -> ~0 and SLA attainment up.
- **Disproved:** materials mix as lever; poller 44h floor; 40% searches
  fail; scheduled->dispatch queue (0 h).

## Saved queries (folder writes STILL BLOCKED, sensitive-file; 11-21 too)

Shapes (rebuild from these):
- fleet-time-budget-daily: DISTINCT operator_events 30d, LEAD next (or
  now); class by opening event; exclude OPERATOR_REMOVED; by start day.
- idle-with-backlog: gaps = WORK_COMPLETED/ABORTED -> next event, since a
  fixed date; LEFT JOIN orders ACCEPTED <= gap start, first DISPATCHED >
  gap start or null; gaps w/ backlog, idle h, p50/p90 gap, p50 waiting.
- backlog-age-daily: per order min ACCEPTED / min RESOLVED|FAILED (45d);
  days UNNEST(sequence(current_date-10d..today)); eod = least(d+1, now).
- sla-attainment-by-descriptor: resolved 7d, acc->res h, % <=24h, last-2d
  split; descriptor via latest snapshot request_id -> latest requests row.
- intake-3h-blocks: distinct CREATED/ACCEPTED per 3h block, 48h.
- scheduled-window-accuracy (#244), materials-by-descriptor,
  repeat-by-descriptor (#234), resident-post-resolution-searches (#227).

## Lessons

- Operator event payloads have NO `$.order_id` (despite reference.md).
- public_api_calls.request_params is a plain string `order_id=<id>`.
- Satisfaction lives customer-side; never read it.
- Use Write, not Edit, sed or python; rewrite whole files. Write creates
  report folder; mkdir is blocked.
- `gh issue view` takes --comments OR --json, not both; use --json
  comments --jq.
- Don't assert unmeasured facts in a ticket body; measure first.
- Top-level posts <=75 words; aim for 65.
- Check upstream intake before reading a demand (or backlog) drop as real.
- `gh`: one call per issue; for-loops blocked.
- All gh comments show seththeeke; tell agents apart by marker.
- Repeat contact from a covered persona still gets `track_contact`.
- `list_contacts`: page once with cursor; stop at empty/null.
- Read the simulation code before blaming the product.
- Board has no remove command; off-board bugs stay in Intake harmlessly.
- New evidence on an existing ticket = comment, not a new ticket.
- A COO/CTO ack reply needing no response: note it, no reply needed.
- Fleet-sizing judgment is Brogan's: share signal in chat, not a ticket.
- A cto-agent feasibility comment != cto-approved label; check the label.

## Run log

- 11-20 07:00 (audit): #170 evidence, #166 +4; 5 contacts; 3/10 queries.
- 11-20 10/13/19:00 (conv): 4 contacts -> #166 / declined; no posts.
- 11-21 07:00 (audit): no new ticket; #170 + #181 comments; 2 contacts
  (1 -> #166, 1 declined); 5/10 queries; inbox empty, no Seth mentions;
  board unchanged; CPO_DAILY 01M7Z38X0EHSFH0BNYP520B91B (flagged intake
  stall to Brogan in thread).
- 11-21 13:00 (conv): inbox empty; checked all open tagged issues, no new
  Rex/Seth input; 1 contact (notification prefs by severity) -> #166,
  commented there; board unchanged (no cto-approved on #181/#244); 0/2
  queries; no chat post.
- 11-21 16:00 (conv): inbox empty; no new Rex/Seth input on any open
  issue (timestamps all mine from 13:00 run); 1 contact (construction
  site reopening for route planning) -> #166, commented there; board
  unchanged (#181/#244 still Intake, no cto-approved); 0/2 queries; no
  chat post.
