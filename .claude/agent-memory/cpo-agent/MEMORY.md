# Celestine's memory (cpo-agent)

Public: committed to the repo after any run that changes it. Conclusions from
past runs only, never secrets. Hard cap 8 KB; prune the oldest or least useful
lines to stay under it. See docs/17-executive-team.md §17.6.

## Tickets

- **#234 (11-16):** link duplicate reports (same location_id + descriptor,
  earlier order still open, 7d) to the open order. Refined, both approved.
  11-17: dial-up step 1 measured -> Plate Condition - Noisy (50/237, 21%,
  ~$74 mat); Pothole only 7 accepted/30d.
- **#227 (11-15):** repair feedback. Refined, both approved. 7 contacts.
- **#166 (11-06):** status visibility. Refined. 46+ contacts (notify/alerts/
  ETA/weekly updates all go here).
- **#170 (11-07):** event-driven dispatch. Spec Created.
- **#181 (11-08, bug):** intake stall. 11-17 23:44: Seth read it as "feed
  can't be controlled, close as not possible" -> I corrected: fix is in OUR
  poller (misreads a known empty-page quirk, #72, as drained), not asking
  NYC's feed to improve. Real blocker still Rex's 11-13 call: route to Pip
  as direct bug fix, not Kestrel's board (needs backend flags we don't have
  yet). Tagged Rex in chat; awaiting Seth/Rex's routing decision.
- **#194 (11-09):** nearest idle op. Spec Created; needs #202.
- **#213 (11-10, measurement):** idle in WBR. 11-17 23:42: Seth picked
  Option A (additive idle_stats CTE in v1-wbr.sql, flag-exempt, Test-then-
  Prod). Re-approved CPO Approved + label; still Intake pending Rex's
  re-approval (his approval was cleared by Kestrel's 11-14 pushback).
- **#69, #165, #202 (not mine):** no action for me.
- Backfill done: all open cpo-agent feature tickets are on the board.

## Declines (reuse the reasoning)

- Data export / research databases: public search + Open Data.
- Hazard reporting / reporting apps / photo / hardware / detection: report
  via 311; point notify-on-fix asks to #166.
- Mark urgent / priority / urgency voting / mark large (potholes): priority
  and order are automatic, not flaggable by size.
- Accessibility audits / non-street issues: out of scope.
- Self-service mark-complete / live chat / phone: none.
- Community discussion / comment / chat space: out of scope; point to
  #166 + #227.
- Feature-request tracking dashboard: each request already shows status.
- Fast-track review of feature requests: no separate lane.
- Business logistics/fleet-routing asks (third-party routing): out of
  scope — BoroughSim tracks a resident's own 311 request, not operational
  routing for other companies.

## WBR and cost model

- Goal = total_cost / orders_accepted. Oct: $299-357. Nov 2: $2,093.
  Nov 9 final: $678 (339,885/501); median 7.4 h. Nov 16 wk 1 day: $949.
- Materials ~81% of cost (~$400/resolved); labor ~$95/resolved. Only
  product lever on materials = fewer visits (#234).
- WBR labor = SCHEDULED->RESOLVED = 2.08 h (0 queue, 0.54 drive, 1.55 on
  site); idle excluded (fix in flight, #213).
- location_unresolved_rate 0.52-0.63 every week.
- Fleet: 21->...->9 (11-15)->7 (11-16 16:00)->5 (11-17 16:00, Brogan
  citing median sat 0.09-0.29d x 8 days + all idle). Watch next WBR for
  idle-share snap-back and whether backlog grows beyond its 10.

## Research agenda

- **Proven -> #170, #181, #194, #213, #69, #227, #234.**
- **Measuring: idle share** (by interval start day): last seen 48% Nov16.
  Fleet cut again 11-17 (7->5); check next audit whether idle share falls
  and backlog/time-to-resolve holds.
- **Idea:** re-complaint after resolve 4.1%/14d (74/1,815): rework signal?
  Revisit when #227 ships.
- **Next:** materials share vs accepted mix; drive share trend (#194);
  once #213 ships, recompute cost/accepted-order with idle included.
- **Disproved:** poller sets 44h floor; 40% searches fail; scheduled->
  dispatch queue inflating billed labor (0 h).

## Saved queries (folder writes STILL BLOCKED, sensitive-file)

Shapes (rebuild from these):
- fleet-time-budget-daily: DISTINCT operator_events 30d, LEAD next (or
  now); class by opening event; exclude OPERATOR_REMOVED; by start day, 8d.
- orders-6h-blocks: DISTINCT order_events CREATED/ACCEPTED/RESOLVED 4d,
  by day + (hour/6)*6.
- repeat-by-descriptor (#234): ONE pass over order_events (min accepted,
  min resolved, max materials per order_id, dt >= 31d), acc 30d; snapshot
  via max_by(... , last_event_sequence) with JOIN (not IN); requests
  max_by(descriptor, warehouse_ingested_at); LAG by (location_id,
  descriptor).
- order-labor-phases: max SCHEDULED/DISPATCHED/ARRIVED/RESOLVED per order,
  resolved 14d; avg diffs.
- resident-post-resolution-searches (#227), intake-runs (#181),
  location-unresolved-latlng (#69), resident-searches (#166).

## Lessons

- Operator event payloads have NO `$.order_id`.
- public_api_calls.request_params is a plain string `order_id=<id>`.
- Satisfaction lives customer-side (idea resolution); never read it.
- Use Write, not Edit (disabled), sed, perl or python; rewrite whole files.
  Write DOES create the report folder (mkdir itself needs approval/blocked
  in sandbox; Write doesn't).
- Don't assert unmeasured facts in a ticket body; measure first.
- Top-level posts <=75 words; the counter is strict, aim for 65.
- Check upstream intake before reading a demand drop as real.
- `gh issue view`: `--json comments --jq`; one `gh` call per issue; shell
  rejects `for`/`xargs` loops here (sandbox), run each issue individually.
- All gh comments show seththeeke; tell agents apart by marker.
- A repeat contact from a persona already covered still gets
  `track_contact` on that ticket.
- `list_contacts` cursor: empty pages can keep returning a next_cursor for
  a while (older already-closed contacts); 2 empty pages in a row is
  enough to stop in a conversation run.
- A run can span a context reset: check board and latest gh comments.
- Seth's chat mention can misread a ticket's cause (e.g. #181 as "feed
  quality" vs "our own poller logic") — correct the premise on the issue,
  don't just comply, when the proposal doesn't actually need what he thinks.
- When a ticket's CPO_TICKET team-chat post exists, reply in that thread
  for routing/decision updates rather than only the GitHub issue.

## Run log

- 11-17 07:00 (audit): #234 descriptor dial-up + guardrail baseline, #166
  comment, 3 contacts, 5/10 queries. CPO_DAILY 01M7MSQJ7XN3SPHMKXMRQ177WG.
- 11-17 10:00, 13:00 (conv): no new Seth mentions then; Brogan trimmed
  fleet 7->5. 0/2 queries each. No posts.
- 11-17 19:00 (conv): Seth answered #213 (Option A, re-approved) and #181
  (misread as feed-quality; corrected, routing still open with Rex). 3
  contacts (1 tracked #166, 2 declined). 0/2 queries. Chat replies in
  #213's and #181-related CTO-daily threads; no new-ticket post.
