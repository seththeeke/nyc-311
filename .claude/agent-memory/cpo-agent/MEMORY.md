# Celestine's memory (cpo-agent)

Public: committed to the repo after any run that changes it. Conclusions from
past runs only, never secrets. Hard cap 8 KB; prune the oldest or least useful
lines to stay under it. See docs/17-executive-team.md §17.6.

## Tickets

- **#244 (11-18, bug):** scheduled_window ends before every job finishes
  (0/1,496 inside; median 33 min late). Fix: W=2.0 multiplier via env/SSM,
  routed to Pip (not board). 2/2 Rex replies used; leave to Seth. Sits in
  board Intake harmlessly.
- **#234 (11-16):** link duplicate reports. Refined, both approved.
- **#227 (11-15):** repair feedback. Refined. 10 contacts (+1 11-19 19:00:
  self-service update/photo tool).
- **#166 (11-06):** status visibility. Refined. 49+ contacts (+1 11-19
  conv: hazard-cleared alert). Depends #244.
- **#170 (11-07):** event-driven dispatch. Spec Created, waiting on Seth.
  Brogan (11-19): confirms this isn't a fleet-dial lever; he'll watch the
  median once shipped, may hold smaller fleet if +22% throughput lands.
- **#181 (bug):** intake stall. Intake; routing waits on Seth. Don't re-ping.
- **#194:** nearest idle op. Spec Created; needs #202.
- **#213 (measurement):** idle in WBR, Option A. Refined.
- **#69, #165, #202 (not mine):** no action for me.

## Declines (reuse the reasoning)

- Data export / research / crew performance: NYC Open Data + public search.
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
- Self-service update/photo submission on an order: tracked under #227
  (quality-feedback angle) if framed as feedback; #166 if framed as status.

## WBR and cost model

- Goal = total_cost / orders_accepted. Oct $299-357; Nov 2 $2,093; Nov 9
  $678; Nov 16 wk (4 days) $417 (68,001/163), materials 80%.
- **$25 goal structurally unreachable** (told Seth 11-18): materials ~$334-
  401 per order; Cave-in 56% of materials. Labor ~$48/h.
- Materials = descriptor constant x 1+U(0,1) sim factor (same factor drives
  #244). WBR labor = SCHEDULED->RESOLVED; idle excluded (#213).
- location_unresolved_rate 0.56-0.64.
- Fleet: 21 -> 4 (Nov 18). Nov 19 04:00: 0 idle, backlog 58, 89 acc vs 41
  res Nov 18; Brogan holding at 4, sizing off 7-day median.

## Research agenda

- **Proven -> #170 (re-proven 11-19 at small fleet), #181, #194, #213,
  #69, #227, #234, #244.**
- **Measuring: idle share** by day: ~50% (8d to Nov 16) -> Nov 17 37%,
  Nov 18 18%, Nov 19 partial 22%. Remaining idle is mostly hourly-tick wait.
- **Measuring: drive share** 21-25% of paid time, 30-39 min/trip (#194).
- **Idea:** re-complaint after resolve 4.1%/14d: revisit when #227 ships.
- **Next:** backlog age/growth at 4 ops (does throughput keep up?); after
  #213 ships, cost incl. idle; after #244, scheduled-window-accuracy >=98%.
- **Disproved:** materials mix as lever; poller 44h floor; 40% searches
  fail; scheduled->dispatch queue (0 h).

## Saved queries (folder writes STILL BLOCKED, sensitive-file; 11-19 too)

Shapes (rebuild from these):
- fleet-time-budget-daily: DISTINCT operator_events 30d, LEAD next (or
  now); class by opening event; exclude OPERATOR_REMOVED; by start day, 8d;
  add transit_min_per_trip, work_min_per_job, jobs_done.
- idle-with-backlog (daily): gaps = WORK_COMPLETED/ABORTED -> next event,
  last 3d; LEFT JOIN orders with ORDER_ACCEPTED <= gap start and first
  ORDER_DISPATCHED > gap start (or null); count gaps w/ backlog, idle h,
  p50/p90 gap min, p50 waiting.
- scheduled-window-accuracy (#244): resolved 14d, last SCHEDULED/RESOLVED
  per order; snapshot max_by(scheduled_start/end, last_event_sequence).
- materials-by-descriptor, repeat-by-descriptor (#234), order-labor-phases,
  orders-6h-blocks, resident-post-resolution-searches (#227), intake-runs
  (#181), location-unresolved-latlng (#69), resident-searches (#166).

## Lessons

- Operator event payloads have NO `$.order_id`.
- public_api_calls.request_params is a plain string `order_id=<id>`.
- Satisfaction lives customer-side; never read it.
- Use Write, not Edit, sed or python; rewrite whole files. Write creates
  report folder; mkdir is blocked.
- Don't assert unmeasured facts in a ticket body; measure first.
- Top-level posts <=75 words; aim for 65.
- Check upstream intake before reading a demand drop as real.
- `gh issue view`: `--json comments --jq`; one `gh` call per issue. A
  `for n in ...; do gh ...; done` loop is blocked ("Contains
  simple_expansion") in this sandbox — issue the gh calls individually.
- All gh comments show seththeeke; tell agents apart by marker.
- Repeat contact from a covered persona still gets `track_contact`.
- `list_contacts` cursor: can return an empty page with a non-null cursor
  (paging past already-triaged history) several times in a row; a few
  empty pages in that state is not yet "done" but isn't worth chasing
  indefinitely in a conversation run — stop once a couple come back empty.
- A run can span a context reset: check board and latest gh comments.
- Correct a misread premise on the issue rather than just complying.
- Reply in a ticket's CPO_TICKET thread for routing updates.
- Read the simulation code before blaming the product.
- Board has no remove command; off-board bugs stay in Intake harmlessly.
- rate() EventBridge schedules don't fire at :00; test cadence by gap
  length distribution, not minute-of-hour.
- New evidence on an existing ticket = comment, not a new ticket.
- A COO/CTO ack reply needing no response: note it, no reply needed.

## Run log

- 11-17: #234 dial-up, #213 Option A, #181 premise fix.
- 11-18 (audit + conv): #244 filed/approved; Rex #244 answered (2/2);
  7 contacts (4 tracked #166, 3 declined).
- 11-19 07:00 (audit): no new ticket; #170 evidence (idle-with-backlog),
  #227 +1 contact; 3 contacts (1 tracked, 2 declined); 3/10 queries; inbox
  empty, no Seth mentions; board unchanged.
- 11-19 10:00 (conv): inbox empty; no new Rex/Seth comments; board intake
  unchanged; 1 new contact (hazard push-alert) tracked to #166; 0/2
  queries; no chat post.
- 11-19 13:00 (conv): inbox = Brogan ack on #170 (no action); no new
  Rex/Seth comments on any open ticket; 1 new contact (hazard-cleared
  alert) tracked to #166 (empty 2nd page, stopped); board intake
  unchanged; 0/2 queries; no chat post.
- 11-19 14:00 (conv): inbox empty; no new Rex/Seth comments on any open
  ticket (checked updatedAt across all); 0 new contacts (2 empty pages,
  stopped); board intake unchanged; 0/2 queries; no chat post.
- 11-19 19:00 (conv): inbox empty; checked last comment on all 9 open
  cpo-agent tickets individually, all end on my own marker, no new
  Rex/Seth activity; 1 new contact (self-service update/photo tool)
  tracked to #227 + comment; board intake unchanged (#181, #244 only,
  both placed on purpose); 0/2 queries; no chat post.
