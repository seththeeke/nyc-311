# Celestine's memory (cpo-agent)

Public: committed to the repo after any run that changes it. Conclusions from
past runs only, never secrets. Hard cap 8 KB; prune the oldest or least useful
lines to stay under it. See docs/17-executive-team.md §17.6.

## Tickets

- **#227 (11-15, new):** resident repair feedback. Proposed route
  `POST /v1/requests/{order_id}/feedback`, op `SUBMIT_REPAIR_FEEDBACK`.
  Covers 5 contacts (Sycamore, Sassafras x2, Yellowwood, Ginkgo-effectiveness).
  Board Intake. NOT yet cpo-approved: waiting on Rex (is a new
  actionTools.ts tool definition in bounds? new entity or Contact type?).
  CPO_TICKET 01M7FMWXKZN5JW2H2KNV1THJBZ. Approve once Rex answers.
- **#166 (11-06):** status visibility via `searchRequests.description`
  wording. Refined, both approved. 39+ contacts.
- **#170 (11-07):** event-driven dispatch. Spec Created.
- **#181 (11-08, bug):** intake stall. Intake, escalated to Seth. 11-15
  comment: stalled again, no order events at all Nov 15 00:00–13:00.
- **#194 (11-09):** nearest idle op. Spec Created; needs #202.
- **#213 (11-10, measurement):** idle in WBR. Pushback cleared both
  approvals; I answered 11-14, posed A vs B to Seth. Still no Seth answer
  as of 11-15 16:00. Re-approve once he picks.
- **#69 (not mine):** lat/lng fallback. Refined.
- **#165, #202 (not mine):** Spec Created, need CEO. No action for me.

## Declines (reuse the reasoning)

- Data export / research / analysis tools (Ginkgo, 8th+): public search +
  Open Data.
- Hazard detection/reporting/photo/hardware/apps (Dogwood repeats): 311/911.
- Mark urgent / priority / urgency voting: priority is automatic.
- Accessibility audits / non-street issues: out of scope.
- Self-service mark-complete / live chat / phone: none.
- Notify/alert/status-timing → #166. Repair quality/feedback → #227.
- Pothole prioritisation → track on #69.
- Fast-track review of feature requests: no separate lane.

## WBR and cost model

- Goal = total_cost / orders_accepted. Oct: $299–$357. Nov 2: $2,093.
- Nov 9 wk (thru 11-14): $329,427/447 = $737; 703 resolved; median 7.7 h.
- Materials ~80% of cost, ~$371/resolved; <$25 unreachable (told Seth 11-07).
- WBR labor = SCHEDULED→RESOLVED; idle excluded (#213). ~$45/op-hour.
- location_unresolved_rate 0.52–0.59 every week since Oct.
- Scheduler hourly, 200/run. Poller 03/09/15/21 UTC, 10k cap.
- Fleet: 21→19→17→15→14→13→11 (Brogan released 2 on 11-15 04:00, backlog 0).

## Research agenda

- **Proven → #170, #181, #194, #213, #69, #227.**
- **Proven 11-15 → #227:** no BoroughSim satisfaction signal; residents
  don't return after resolve (2 of 70 searches in 14d post-resolve).
- **Measuring: idle share.** 19% Nov 9, 34, 37, 63, 88% Nov 13, 54% Nov 14
  (~$9.9k idle). Mostly intake stalls (#181), then dispatch (#170).
- **Idea:** materials estimate ~33% low. Low priority.
- **Idea (next):** once #227 ships, defect/rework rate → cost.
- **Disproved:** poller sets 44 h floor (11-13); 40% searches fail (11-11).

## Saved queries (folder writes STILL BLOCKED, sensitive-file, 11-15 too)

Shapes (rebuild from these):
- fleet-time-budget-daily: DISTINCT operator_events 30d, LEAD next (or
  now); class by opening event; exclude OPERATOR_REMOVED; latest rate;
  by start day, 8d. 2.5 MB.
- orders-6h-blocks: DISTINCT order_events CREATED/ACCEPTED/RESOLVED 4d,
  by day + (hour/6)*6. 4 MB.
- resident-post-resolution-searches (#227, weekly): public_api_calls
  SEARCH_REQUESTS `resident:%` 14d; order id =
  regexp_extract(request_params,'order_id=([0-9A-Z]+)',1) (NOT JSON);
  join MIN ORDER_RESOLVED; count searches after resolve. 2.4 MB.
- intake-runs (#181), location-unresolved-latlng (#69, 204 MB),
  resident-searches (#166), contact-vs-search-overlap (#166).

## Lessons

- Operator event payloads have NO `$.order_id`.
- public_api_calls.request_params is a plain string `order_id=<id>`.
- Satisfaction lives customer-side (idea resolution); never read it.
- public_api requester from `X-Requester`; customer sends
  `resident:<persona>`.
- Use Write, not Edit/sed; grep on /tmp blocked; curl denied; one command
  per Bash call (no `;`/`&&`); `mkdir` alone via Bash works, chained
  with `&&` needs approval.
- `grep --include=*` fails in zsh; use plain paths.
- Morning runs land ~13:00 UTC.
- Top-level posts ≤75 words.
- Check upstream intake before reading a demand drop as real.
- Self-joins over 7 d of operator_events time out.
- `gh issue view`: `--json comments -q`; no for-loops over issue numbers.
- All gh comments show seththeeke; tell agents apart by marker.
- customer/backend/ decision logic is off-limits; only a tool's own
  definition in actionTools.ts (description, schema) is a lever.
- Skip chat-thread hunting when only GitHub needed updating.
- A repeat contact from a persona already covered by a ticket still gets
  `track_contact` on that ticket (new contact_id each time).

## Run log

- 11-14 (audit + 3 conversations): #166 reworked → Refined; #69/#165
  approved; 8 contacts handled; repair-quality cluster held for audit.
- 11-15 07:00 (audit): 7 contacts (4 → #227, 3 declined); filed #227,
  board Intake; #181 stall evidence; 4/10 queries; CPO_DAILY
  01M7FMX0Y2MYCA9HPR67BESP0B.
- 11-15 16:00 (conversation): inbox empty; no Seth mentions pending on
  166/181/194/202/213/69/227 (all last-commented by me); 2 new contacts:
  Dogwood hazard-detection declined, Sassafras repair-feedback → #227
  (now 5 contacts). No board moves, no queries, no chat post.
