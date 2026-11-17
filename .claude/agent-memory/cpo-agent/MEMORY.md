# Celestine's memory (cpo-agent)

Public: committed to the repo after any run that changes it. Conclusions from
past runs only, never secrets. Hard cap 8 KB; prune the oldest or least useful
lines to stay under it. See docs/17-executive-team.md §17.6.

## Tickets

- **#234 (11-16):** link duplicate reports (same location_id + descriptor,
  earlier order still open, 7d) to the open order. Refined, both approved.
  11-17: dial-up step 1 measured -> Plate Condition - Noisy (50/237, 21%,
  ~$74 mat); Pothole only 7 accepted/30d. Wrong-merge guardrail baseline
  4.1% (re-complaint 14d after resolve). Body + comment updated.
- **#227 (11-15):** repair feedback. Refined, both approved. 7 contacts.
- **#166 (11-06):** status visibility. Refined. 44+ contacts (notify/alerts/
  ETA/weekly updates all go here).
- **#170 (11-07):** event-driven dispatch. Spec Created.
- **#181 (11-08, bug):** intake stall. Intake, escalated to Seth 11-13, no
  answer by 11-17. Stalls continue. 3 evidence comments already; don't add
  more unless something changes.
- **#194 (11-09):** nearest idle op. Spec Created; needs #202. Drive =
  0.54 h of 2.08 h billed labor/order (26%).
- **#213 (11-10, measurement):** idle in WBR. A vs B posed to Seth 11-14,
  unanswered 11-17. Re-approve once he picks.
- **#69, #165, #202 (not mine):** no action for me.
- Backfill done: all open cpo-agent feature tickets are on the board.

## Declines (reuse the reasoning)

- Data export / research databases: public search + Open Data.
- Hazard reporting / reporting apps / photo / hardware / detection: report
  via 311; point notify-on-fix asks to #166.
- Mark urgent / priority / urgency voting: priority is automatic.
- Accessibility audits / non-street issues: out of scope.
- Self-service mark-complete / live chat / phone: none.
- Community discussion / comment / chat space (11-17): out of scope; point
  to #166 + #227.
- Feature-request tracking dashboard: each request already shows status.
- Fast-track review of feature requests: no separate lane.
- Business logistics/fleet-routing asks (e.g. construction-block alerts for
  a hauling company's routes, 11-17): out of scope — BoroughSim tracks a
  resident's own 311 request, not third-party operational routing.

## WBR and cost model

- Goal = total_cost / orders_accepted. Oct: $299-357. Nov 2: $2,093.
  Nov 9 final: $678 (339,885/501); median 7.4 h. Nov 16 wk 1 day: $949
  (40 acc, 75 resolved, drain-billed).
- Materials ~81% of cost (~$400/resolved); labor ~$95/resolved.
  Materials actual = estimate x processing random factor
  (orderExecutionService.ts:118); estimate constant per descriptor. Only
  product lever on materials = fewer visits (#234).
- WBR labor = SCHEDULED->RESOLVED = 2.08 h (0 queue, 0.54 drive, 1.55 on
  site); idle excluded (#213). ~$45/op-hour.
- location_unresolved_rate 0.52-0.63 every week.
- Scheduler hourly, 200/run. Poller 03/09/15/21 UTC, 10k cap.
- Fleet: 21->...->9 (11-15)->7 (Brogan 11-16 16:00), plans more cuts.

## Research agenda

- **Proven -> #170, #181, #194, #213, #69, #227, #234.**
- **Measuring: idle share** (by interval start day): 18% Nov9, 34, 37, 63,
  88% Nov13, 58, 14% Nov15, 48% Nov16.
- **Idea:** re-complaint after resolve 4.1%/14d (74/1,815): rework signal?
  Revisit when #227 ships. Cave-in 17, Plate Noisy 22, Blocked 16.
- **Next:** materials share vs accepted mix; drive share trend (#194).
- **Disproved:** poller sets 44h floor (11-13); 40% searches fail (11-11);
  scheduled->dispatch queue inflating billed labor (0 h, 11-17).

## Saved queries (folder writes STILL BLOCKED 11-17, sensitive-file)

Shapes (rebuild from these):
- fleet-time-budget-daily: DISTINCT operator_events 30d, LEAD next (or
  now); class by opening event; exclude OPERATOR_REMOVED; by start day, 8d.
  1.4 MB.
- orders-6h-blocks: DISTINCT order_events CREATED/ACCEPTED/RESOLVED 4d,
  by day + (hour/6)*6. 4.5 MB.
- repeat-by-descriptor (#234): ONE pass over order_events (min accepted,
  min resolved, max materials per order_id, dt >= 31d), acc 30d; snapshot
  via max_by(... , last_event_sequence) with JOIN (not IN); requests
  max_by(descriptor, warehouse_ingested_at); LAG by (location_id,
  descriptor). 66 MB, 3 s. (37d version with IN + 2 scans timed out.)
- order-labor-phases: max SCHEDULED/DISPATCHED/ARRIVED/RESOLVED per order,
  resolved 14d; avg diffs. 4 MB.
- resident-post-resolution-searches (#227), intake-runs (#181),
  location-unresolved-latlng (#69, 204 MB), resident-searches (#166).

## Lessons

- Operator event payloads have NO `$.order_id`.
- public_api_calls.request_params is a plain string `order_id=<id>`.
- Satisfaction lives customer-side (idea resolution); never read it.
- Use Write, not Edit (disabled), sed, perl or python; rewrite whole files.
  wc/grep on /tmp blocked; curl denied; one command per Bash call; let
  Write create dirs.
- Don't assert unmeasured facts in a ticket body; measure first.
- Top-level posts <=75 words; the counter is strict, aim for 65.
- Check upstream intake before reading a demand drop as real.
- Self-joins over 7d of operator_events time out; LAG window joins fine.
  Avoid `IN (subquery)` on snapshots/requests; JOIN + max_by is fast.
- `gh issue view`: `--json comments --jq`; one `gh` call per issue; shell
  rejects `for`/`xargs` loops here (sandbox), run each issue individually.
- All gh comments show seththeeke; tell agents apart by marker.
- customer/backend/ decision logic off-limits.
- A repeat contact from a persona already covered still gets
  `track_contact` on that ticket.
- `list_contacts` cursor: one empty page after the first means done.
- A run can span a context reset: check board and latest gh comments.

## Run log

- 11-15: filed #227. CPO_DAILY 01M7FMX0Y2MYCA9HPR67BESP0B.
- 11-16 07:00: filed #234, 7 contacts, 4/10 queries. CPO_DAILY
  01M7J7BZGHRR72W5KHBZJE07RZ. Later convs: #234 -> Refined.
- 11-17 07:00 (audit): #234 descriptor dial-up + guardrail baseline,
  #166 comment, 3 contacts (2 tracked #166, 1 declined), 5/10 queries
  (1 timeout). No new ticket. CPO_DAILY 01M7MSQJ7XN3SPHMKXMRQ177WG.
- 11-17 10:00 (conv): no new Seth mentions on 8 open tickets; board
  Intake unchanged (#213, #181 both still waiting on Seth). 1 contact
  (business-logistics ask), declined. 0/2 queries. No post.
