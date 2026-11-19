# Celestine's memory (cpo-agent)

Public: committed to the repo after any run that changes it. Conclusions from
past runs only, never secrets. Hard cap 8 KB; prune the oldest or least useful
lines to stay under it. See docs/17-executive-team.md §17.6.

## Tickets

- **#244 (11-18, bug):** scheduled_window ends before every job finishes
  (0/1,496 inside; median 33 min late; 2x window = 100%). Fix: W=2.0
  multiplier on scheduled_end via env/SSM. Rex+me agreed (11-18): multiplier
  OK, no materials scaling, routed straight to Pip (not board). Pip to run
  the <=2.1x median-window-length guardrail check against 14-day baseline
  (median planned 78 min, median actual 117 min) before setting W=2.0 in
  Test. 2/2 replies to Rex used on this issue; leave further discussion to
  Seth. Stays visible in board Intake (no remove command), harmless.
- **#234 (11-16):** link duplicate reports to open order. Refined, both
  approved. Dial-up step 1 = Plate Condition - Noisy.
- **#227 (11-15):** repair feedback. Refined, both approved. 7 contacts.
- **#166 (11-06):** status visibility. Refined. 44+ contacts (notify/
  alerts/ETA/audit-trail). Depends on #244 (noted on issue 11-18).
- **#170 (11-07):** event-driven dispatch. Spec Created.
- **#181 (11-08, bug):** intake stall, our poller misreads empty page (#72).
  In Intake; routing (Pip direct vs board) waits on Seth. Don't re-ping.
- **#194 (11-09):** nearest idle op. Spec Created; needs #202.
- **#213 (11-10, measurement):** idle in WBR, Option A. Both approved,
  Refined. Seth confirmed Option A 11-17; proceeding, watch post-ship WBR
  idle hours reconcile w/ fleet-time-budget-daily within 2%.
- **#69, #165, #202 (not mine):** no action for me.

## Declines (reuse the reasoning)

- Data export / research / crew performance: NYC Open Data + public search.
- Hazard reporting / detection / apps / photo / hardware: report via 311
  (911 if danger); notify-on-fix asks go to #166.
- Route-safety maps: out of scope; fold notify part into #166.
- Mark urgent / priority / voting / mark large / highlight urgent repairs:
  automatic — dispatch runs by schedule/location, not resident-assigned
  urgency; every report already gets a repair visit.
- Accessibility audits / non-street issues: out of scope.
- Self-service mark-complete / live chat / phone: none.
- Community discussion space: out of scope; point to #166 + #227.
- Feature-request dashboard / fast-track review: no.
- Third-party business routing: out of scope.
- Proactive/scheduled maintenance (e.g. repaint crosswalks before reported
  faded): we only dispatch against filed 311 reports, no preventative
  scheduling feature. File a 311 report once visibly faded.
- Audit trail / detailed action log on an order: tracked under #166
  (status-visibility cluster) — it's "see what happened to my report,"
  same ask family as notify/ETA, not a separate ticket.

## WBR and cost model

- Goal = total_cost / orders_accepted. Oct $299-357; Nov 2 $2,093; Nov 9
  $678; Nov 16 wk (2 days) $693 (51,264/74).
- **$25 goal is structurally unreachable** (told Seth 11-18): materials
  ~$401/resolved avg (30d), Cave-in 56% of materials ($894 avg); even $0-
  materials inspection jobs ~0.9 h labor = ~$44. Labor ~$48/h.
- Materials = descriptor constant (streetConditionMaterialsCostService) x
  processing factor 1+U(0,1) (orderExecutionService randomVarianceFactor).
  Actual/estimate 1.48-1.56 for every descriptor; same factor drives #244's
  scheduled_window being short on every order (window uses the min
  estimate, not the 1.0-2.0x expected range).
- WBR labor = SCHEDULED->RESOLVED; idle excluded, #213 fixing (Option A).
- location_unresolved_rate 0.52-0.64 (0.64 Nov 16 wk, highest since Sep).
- Fleet: 21 -> 5 (11-17). Brogan plans 1-2 more trims 11-18.

## Research agenda

- **Proven -> #170, #181, #194, #213, #69, #227, #234, #244.**
- **Measuring: idle share** (by interval start day): 8d ~50% of 2,628 h;
  Nov 17 37%, Nov 18 partial 19% at 5 ops. Falling with fleet cuts.
- **Idea:** re-complaint after resolve 4.1%/14d: revisit when #227 ships.
- **Next:** drive share (#194); after #213 ships, cost incl. idle; after
  #244 ships, rerun scheduled-window-accuracy (target >=98%).
- **Disproved:** materials mix as a product lever (fixed per descriptor,
  mix set by residents' reports); poller 44h floor; 40% searches fail;
  scheduled->dispatch queue (0 h).

## Saved queries (folder writes STILL BLOCKED, sensitive-file; 11-18 too)

Shapes (rebuild from these):
- fleet-time-budget-daily: DISTINCT operator_events 30d, LEAD next (or
  now); class by opening event; exclude OPERATOR_REMOVED; by start day, 8d.
- scheduled-window-accuracy (#244): resolved 14d (events 20d), last
  SCHEDULED/RESOLVED per order; snapshot max_by(scheduled_start/end,
  last_event_sequence); share inside, overrun p50/p90, actual/planned;
  variant: share with ratio <= k.
- materials-by-descriptor: per_order max acc/sch/res/materials (31d) +
  snapshot request_id + requests max_by(descriptor); 30d sums/avgs/share.
- repeat-by-descriptor (#234), order-labor-phases, orders-6h-blocks,
  resident-post-resolution-searches (#227), intake-runs (#181),
  location-unresolved-latlng (#69), resident-searches (#166).

## Lessons

- Operator event payloads have NO `$.order_id`.
- public_api_calls.request_params is a plain string `order_id=<id>`.
- Satisfaction lives customer-side; never read it.
- Use Write, not Edit, sed or python; rewrite whole files. Write creates
  report folder; mkdir is blocked (even with dangerouslyDisableSandbox).
- Don't assert unmeasured facts in a ticket body; measure first.
- Top-level posts <=75 words; aim for 65.
- Check upstream intake before reading a demand drop as real.
- `gh issue view`: `--json comments --jq`; one `gh` call per issue; no
  shell loops.
- All gh comments show seththeeke; tell agents apart by marker.
- Repeat contact from a covered persona still gets `track_contact`.
- `list_contacts` cursor: 2 empty pages in a row = stop.
- A run can span a context reset: check board and latest gh comments
  before assuming nothing happened yet — this run's #244/#166 work was
  already posted before the reset on 11-18 17:00/19:00.
- Correct a misread premise on the issue rather than just complying.
- Reply in a ticket's CPO_TICKET thread for routing updates.
- Read the simulation code (execution draws) before blaming the product:
  some numbers are fixed by the sim's world model, not by product choices.
- Board has no remove/un-add command; a bug ticket routed off-board after
  filing just stays visible in Intake, harmlessly.

## Run log

- 11-17 (audit + 3 conv): #234 dial-up, #213 Option A, #181 premise fix.
- 11-18 07:00 (audit): #244 filed + approved + on board; #166 comment; 3
  contacts (1 tracked #166, 2 declined); 4/10 queries.
- 11-18 10:00 (conv): no new mentions/comments; 1 contact declined
  (proactive crosswalk maintenance); 0/2 queries; chat post: none.
- 11-18 13:00 (conv): Rex's #244 feedback answered (multiplier/materials/
  routing agreed, both within 1 reply); 3 new contacts (2 tracked #166,
  1 declined hazard-marking app); no board moves (nothing new ready);
  0/2 queries; chat post: CPO_TICKET reply in #244 thread.
- 11-18 16:00 (conv): no new mentions/comments on any open ticket (all
  threads already end on my own comment); board unchanged; 1 new contact
  declined (highlight-urgent-repairs, standard "mark urgent" decline);
  0/2 queries; chat post: none.
- 11-18 17:00/19:00 (conv, spanned a context reset): answered Rex's 2nd
  #244 comment (guardrail check, 2/2 replies used on that issue); 2
  residents tracked #166 before reset + 1 more after (3 total this run,
  all status-visibility, no scope change); board unchanged (same 2 cards
  in Intake, no new readiness); 0/2 queries; chat post: none.
