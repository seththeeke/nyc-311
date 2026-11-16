# Celestine's memory (cpo-agent)

Public: committed to the repo after any run that changes it. Conclusions from
past runs only, never secrets. Hard cap 8 KB; prune the oldest or least useful
lines to stay under it. See docs/17-executive-team.md §17.6.

## Tickets

- **#234 (11-16):** link duplicate reports (same location_id + descriptor,
  earlier order still open, 7d) to the open order; one visit resolves both.
  185/1886 accepted (9.8%) in 30d, ~$74k/mo, −$39/accepted. Board Intake,
  NOT approved yet: waiting on Rex (index/GSI for open orders by location;
  BBL coarseness, lat/lng 50 m?). Comment owes: measure top descriptor for
  first dial-up step (body says Pothole, unverified). Approve after Rex.
- **#227 (11-15):** repair feedback. Refined, both approved. 7 contacts.
- **#166 (11-06):** status visibility via `searchRequests.description`.
  Refined. 40+ contacts (notify/alerts/ETA API all go here).
- **#170 (11-07):** event-driven dispatch. Spec Created.
- **#181 (11-08, bug):** intake stall. Intake, escalated to Seth, no answer.
  11-16 comment: empty 18 h Nov 14 18:00–Nov 15 12:00, Nov 16 00–06 1 order.
- **#194 (11-09):** nearest idle op. Spec Created; needs #202.
- **#213 (11-10, measurement):** idle in WBR. A vs B posed to Seth 11-14,
  unanswered. Re-approve once he picks.
- **#69 (not mine):** lat/lng fallback. Refined.
- **#165, #202 (not mine):** need CEO. No action for me.

## Declines (reuse the reasoning)

- Data export / research databases (Ginkgo, 9th+ on 11-16): public search +
  Open Data.
- Hazard reporting / reporting apps / photo / hardware (Dogwood, Sassafras
  11-16 x2): report via 311.
- Mark urgent / priority / urgency voting: priority is automatic.
- Accessibility audits / non-street issues: out of scope.
- Self-service mark-complete / live chat / phone: none.
- Feature-request tracking dashboard: each request already shows status.
- Notify/alert/status-timing/ETA → #166. Repair quality/feedback → #227.
- Pothole prioritisation → track on #69.
- Fast-track review of feature requests: no separate lane.

## WBR and cost model

- Goal = total_cost / orders_accepted. Oct: $299–$357. Nov 2: $2,093.
  Nov 9 final: $339,885/501 = $678; 722 resolved; median 7.4 h.
- Materials ~80% of cost, ~$377/resolved; <$25 unreachable (told Seth 11-07).
  Labor ~$94/resolved order (Nov 9 wk).
- WBR labor = SCHEDULED→RESOLVED; idle excluded (#213). ~$45/op-hour.
- location_unresolved_rate 0.52–0.59 every week since Oct.
- Scheduler hourly, 200/run. Poller 03/09/15/21 UTC, 10k cap.
- Materials estimate: constant per descriptor
  (streetConditionMaterialsCostService.ts; Pothole $75, Cave-in $600, Rough
  roads $400, default $200). Actual avg ~$384, so the estimate looks low.
- Evaluation: no location-level dedupe (orderEvaluationService.ts);
  ingestion dedupes only on 311 unique_key.
- Fleet: 21→…→11→9 (Brogan 11-15 16:00); held at 9 at 23:00, plans more cuts.

## Research agenda

- **Proven → #170, #181, #194, #213, #69, #227, #234.**
- **Proven 11-16 → #234:** duplicate jobs. 302/1886 repeat location within
  7d (168 within 1d); 185 same descriptor while prior open; $57.2k
  materials; p50 gap 20.5 h.
- **Measuring: idle share** (by interval start day): 19% Nov 9, 34, 37, 63,
  88% Nov 13, 58% Nov 14, 14% Nov 15, 25% Nov 16 partial.
- **Next:** #234 by descriptor (which to dial first); re-complaint rate after
  resolve (guardrail baseline for #234).
- **Idea:** materials estimate ~2x low vs actual. Low priority.
- **Idea:** once #227 ships, defect/rework rate → cost.
- **Disproved:** poller sets 44 h floor (11-13); 40% searches fail (11-11).

## Saved queries (folder writes STILL BLOCKED 11-16, sensitive-file)

Shapes (rebuild from these):
- fleet-time-budget-daily: DISTINCT operator_events 30d, LEAD next (or
  now); class by opening event; exclude OPERATOR_REMOVED; by start day, 8d.
  1.4 MB.
- orders-6h-blocks: DISTINCT order_events CREATED/ACCEPTED/RESOLVED 4d,
  by day + (hour/6)*6. 4 MB.
- repeat-orders-same-location (#234, weekly): ORDER_ACCEPTED 37d → latest
  snapshot location_id/request_id → latest requests.descriptor → ORDER_RESOLVED
  materials; LAG over (location_id ORDER BY accepted_at); repeats = prev
  within 7d; same_desc + prev_open (prev resolved NULL or > accepted_at).
  70 MB.
- resident-post-resolution-searches (#227, weekly): public_api_calls
  SEARCH_REQUESTS `resident:%` 14d; order id via
  regexp_extract(request_params,'order_id=([0-9A-Z]+)',1). 2.4 MB.
- intake-runs (#181), location-unresolved-latlng (#69, 204 MB),
  resident-searches (#166), contact-vs-search-overlap (#166).

## Lessons

- Operator event payloads have NO `$.order_id`.
- public_api_calls.request_params is a plain string `order_id=<id>`.
- Satisfaction lives customer-side (idea resolution); never read it.
- Use Write, not Edit (disabled), sed or perl (perl -pi needs approval);
  rewrite whole /tmp files. grep on /tmp blocked; curl denied; one command
  per Bash call; mkdir prompts, so let Write create dirs.
- Don't assert unmeasured facts in a ticket body (e.g. "most common
  descriptor"); measure first.
- `grep --include=*` fails in zsh; use plain paths.
- Top-level posts ≤75 words.
- Check upstream intake before reading a demand drop as real.
- Self-joins over 7 d of operator_events time out; LAG window joins fine.
- `gh issue view`: `--json comments -q`; one `gh` call per issue.
- All gh comments show seththeeke; tell agents apart by marker.
- customer/backend/ decision logic is off-limits; only a tool's own
  definition in actionTools.ts is a lever.
- A repeat contact from a persona already covered still gets
  `track_contact` on that ticket.
- `list_contacts` can return a non-null cursor then an empty page,
  repeatedly, with decreasing dates well into the past (seen 11-16: 3
  empty pages back to Nov 5) — stop after a few once rows are exhausted,
  don't chase it indefinitely in a conversation run.
- `for n in ...; do gh ...; done` in Bash trips the sandbox's
  "Contains simple_expansion" guard; issue one `gh` call per ticket.

## Run log

- 11-15: filed #227 (→ Refined after Rex), 10 contacts across runs,
  #181 stall evidence. CPO_DAILY 01M7FMX0Y2MYCA9HPR67BESP0B.
- 11-16 07:00 (audit): filed #234 (Intake), #181 comment, 7 contacts
  (4 tracked: 3 → #166, 1 → #227; 3 declined), 4/10 queries. CPO_TICKET
  01M7J7BWC99BJW9QXS6HQHP00F, CPO_DAILY 01M7J7BZGHRR72W5KHBZJE07RZ.
- 11-16 10:00 (conversation): no Seth/Rex mentions pending, no new ticket
  comments, no board moves (same 3 Intake cards, same blockers). 2 new
  contacts: Dogwood hazard-detection declined (reuse 311 reasoning),
  Sassafras scheduled-start notifications → #166. 0/2 queries used. Chat
  post: none.
