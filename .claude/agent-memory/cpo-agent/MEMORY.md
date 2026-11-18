# Celestine's memory (cpo-agent)

Public: committed to the repo after any run that changes it. Conclusions from
past runs only, never secrets. Hard cap 8 KB; prune the oldest or least useful
lines to stay under it. See docs/17-executive-team.md §17.6.

## Tickets

- **#244 (11-18, bug):** scheduled_window ends before every job finishes
  (0/1,496 inside; median 33 min late; 2x window = 100%). Fix: W=2.0
  multiplier on scheduled_end via env/SSM. On board (Intake), CPO
  Approved. Asked Rex: multiplier vs flag (#202), and routing (board vs Pip).
- **#234 (11-16):** link duplicate reports to open order. Refined, both
  approved. Dial-up step 1 = Plate Condition - Noisy.
- **#227 (11-15):** repair feedback. Refined, both approved. 7 contacts.
- **#166 (11-06):** status visibility. Refined. 47+ contacts (notify/
  alerts/ETA). 11-18: commented that it depends on #244.
- **#170 (11-07):** event-driven dispatch. Spec Created.
- **#181 (11-08, bug):** intake stall, our poller misreads empty page (#72).
  In Intake; routing (Pip direct vs board) waits on Seth. Don't re-ping.
- **#194 (11-09):** nearest idle op. Spec Created; needs #202.
- **#213 (11-10, measurement):** idle in WBR, Option A. Both approved,
  Refined (11-18).
- **#69, #165, #202 (not mine):** no action for me.

## Declines (reuse the reasoning)

- Data export / research / crew performance: NYC Open Data + public search.
- Hazard reporting / detection / apps / photo / hardware: report via 311
  (911 if danger); notify-on-fix asks go to #166.
- Route-safety maps: out of scope; fold notify part into #166.
- Mark urgent / priority / voting / mark large: automatic.
- Accessibility audits / non-street issues: out of scope.
- Self-service mark-complete / live chat / phone: none.
- Community discussion space: out of scope; point to #166 + #227.
- Feature-request dashboard / fast-track review: no.
- Third-party business routing: out of scope.
- Proactive/scheduled maintenance (e.g. repaint crosswalks before reported
  faded): we only dispatch against filed 311 reports, no preventative
  scheduling feature. File a 311 report once visibly faded.

## WBR and cost model

- Goal = total_cost / orders_accepted. Oct $299-357; Nov 2 $2,093; Nov 9
  $678; Nov 16 wk (2 days) $693 (51,264/74).
- **$25 goal is structurally unreachable** (told Seth 11-18): materials
  ~$401/resolved avg (30d), Cave-in 56% of materials ($894 avg); even $0-
  materials inspection jobs ~0.9 h labor = ~$44. Labor ~$48/h.
- Materials = descriptor constant (streetConditionMaterialsCostService) x
  processing factor 1+U(0,1) (orderExecutionService randomVarianceFactor).
  Actual/estimate 1.48-1.56 for every descriptor.
- WBR labor = SCHEDULED->RESOLVED; idle excluded (#213).
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
  report folder; mkdir is blocked.
- Don't assert unmeasured facts in a ticket body; measure first.
- Top-level posts <=75 words; aim for 65.
- Check upstream intake before reading a demand drop as real.
- `gh issue view`: `--json comments --jq`; one `gh` call per issue; no
  shell loops.
- All gh comments show seththeeke; tell agents apart by marker.
- Repeat contact from a covered persona still gets `track_contact`.
- `list_contacts` cursor: 2 empty pages in a row = stop.
- A run can span a context reset: check board and latest gh comments.
- Correct a misread premise on the issue rather than just complying.
- Reply in a ticket's CPO_TICKET thread for routing updates.
- Read the simulation code (execution draws) before blaming the product:
  some numbers are fixed by the sim's world model, not by product choices.

## Run log

- 11-17 (audit + 3 conv): #234 dial-up, #213 Option A, #181 premise fix.
- 11-18 07:00 (audit): #244 filed + approved + on board; #166 comment; 3
  contacts (1 tracked #166, 2 declined); 4/10 queries. CPO_TICKET
  01M7QC3B7WFNJJ5QVXBF9W403H, CPO_DAILY 01M7QC467ZGNZQYJGZC609XP1E.
- 11-18 10:00 (conv): no new mentions/comments on open tickets; 1 new
  contact declined (proactive crosswalk maintenance); 0/2 queries; chat
  post: none.
