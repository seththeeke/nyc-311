# Celestine's memory (cpo-agent)

Public: committed to the repo after any run that changes it. Conclusions from
past runs only, never secrets. Hard cap 8 KB; prune the oldest or least useful
lines to stay under it. See docs/17-executive-team.md §17.6.

## Tickets

- **#234 (11-16):** link duplicate reports (same location_id + descriptor,
  earlier order still open, 7d) to the open order; one visit resolves both.
  185/1886 accepted (9.8%) in 30d, ~$74k/mo, −$39/accepted. Both CPO + CTO
  approved, moved to **Refined** 11-16 ~19:00. Match = location_id + open +
  descriptor, merge-into-one-visit, only pre-scheduling orders. Still owe:
  measure top descriptor for dial-up step 1 (Seth flagged Pothole was
  unverified) — do at next audit, update body.
- **#227 (11-15):** repair feedback. Refined, both approved. 7 contacts.
- **#166 (11-06):** status visibility via `searchRequests.description`.
  Refined. 40+ contacts (notify/alerts/ETA API all go here).
- **#170 (11-07):** event-driven dispatch. Spec Created.
- **#181 (11-08, bug):** intake stall. Intake, escalated to Seth 11-13, still
  no answer as of 11-16 19:00 (3 "new evidence" comments posted, last
  11-16 13:04). Recurs: empty Nov14 18:00-Nov15 12:00, Nov16 00-06 only 1
  order, then bursts.
- **#194 (11-09):** nearest idle op. Spec Created (Kid Kestrel, 11-14);
  needs #202, no new action.
- **#213 (11-10, measurement):** idle in WBR. A vs B posed to Seth 11-14,
  still unanswered 11-16 19:00. Re-approve once he picks.
- **#69, #165, #202 (not mine):** no action for me.

## Declines (reuse the reasoning)

- Data export / research databases: public search + Open Data.
- Hazard reporting / reporting apps / photo / hardware / detection: report
  via 311; point notify-on-fix asks to #166.
- Mark urgent / priority / urgency voting / pothole reporting tool:
  priority is automatic, no resident-side reporting tool planned on top of
  311.
- Accessibility audits / non-street issues: out of scope.
- Self-service mark-complete / live chat / phone: none.
- Feature-request tracking dashboard: each request already shows status.
- Notify/alert/status-timing/ETA -> #166. Repair quality/feedback -> #227.
- Fast-track review of feature requests: no separate lane.

## WBR and cost model

- Goal = total_cost / orders_accepted. Oct: $299-357. Nov 2: $2,093.
  Nov 9 final: $339,885/501 = $678; 722 resolved; median 7.4 h.
- Materials ~80% of cost, ~$377/resolved; <$25 unreachable (told Seth 11-07).
  Labor ~$94/resolved order (Nov 9 wk).
- WBR labor = SCHEDULED->RESOLVED; idle excluded (#213). ~$45/op-hour.
- location_unresolved_rate 0.52-0.59 every week since Oct.
- Scheduler hourly, 200/run. Poller 03/09/15/21 UTC, 10k cap.
- Materials estimate: constant per descriptor
  (streetConditionMaterialsCostService.ts; Pothole $75, Cave-in $600, Rough
  roads $400, default $200). Actual avg ~$384, looks low.
- Evaluation: no location-level dedupe (orderEvaluationService.ts);
  ingestion dedupes only on 311 unique_key.
- Fleet: 21->...->11->9 (Brogan 11-15 16:00); held at 9 at 23:00, plans more
  cuts.

## Research agenda

- **Proven -> #170, #181, #194, #213, #69, #227, #234.**
- **Measuring: idle share** (by interval start day): 19% Nov9, 34, 37, 63,
  88% Nov13, 58% Nov14, 14% Nov15, 25% Nov16 partial.
- **Next:** #234 by descriptor (which to dial first, owed on ticket); re-
  complaint rate after resolve (guardrail baseline for #234).
- **Idea:** materials estimate ~2x low vs actual. Low priority.
- **Idea:** once #227 ships, defect/rework rate -> cost.
- **Disproved:** poller sets 44h floor (11-13); 40% searches fail (11-11).

## Saved queries (folder writes STILL BLOCKED 11-16, sensitive-file)

Shapes (rebuild from these):
- fleet-time-budget-daily: DISTINCT operator_events 30d, LEAD next (or
  now); class by opening event; exclude OPERATOR_REMOVED; by start day, 8d.
  1.4 MB.
- orders-6h-blocks: DISTINCT order_events CREATED/ACCEPTED/RESOLVED 4d,
  by day + (hour/6)*6. 4 MB.
- repeat-orders-same-location (#234, weekly): ORDER_ACCEPTED 37d -> latest
  snapshot location_id/request_id -> latest requests.descriptor ->
  ORDER_RESOLVED materials; LAG over (location_id ORDER BY accepted_at);
  repeats = prev within 7d; same_desc + prev_open (prev resolved NULL or >
  accepted_at). 70 MB.
- resident-post-resolution-searches (#227, weekly): public_api_calls
  SEARCH_REQUESTS `resident:%` 14d; order id via
  regexp_extract(request_params,'order_id=([0-9A-Z]+)',1). 2.4 MB.
- intake-runs (#181), location-unresolved-latlng (#69, 204 MB),
  resident-searches (#166), contact-vs-search-overlap (#166).

## Lessons

- Operator event payloads have NO `$.order_id`.
- public_api_calls.request_params is a plain string `order_id=<id>`.
- Satisfaction lives customer-side (idea resolution); never read it.
- Use Write, not Edit (disabled), sed or perl; rewrite whole /tmp files.
  grep on /tmp blocked; curl denied; one command per Bash call; mkdir
  prompts even standalone/alone in this sandbox, so let Write create dirs.
- Don't assert unmeasured facts in a ticket body; measure first.
- `grep --include=*` fails in zsh; use plain paths.
- Top-level posts <=75 words.
- Check upstream intake before reading a demand drop as real.
- Self-joins over 7d of operator_events time out; LAG window joins fine.
- `gh issue view`: `--json comments -q`; one `gh` call per issue.
- All gh comments show seththeeke; tell agents apart by marker.
- customer/backend/ decision logic off-limits; only a tool's own definition
  in actionTools.ts is a lever.
- A repeat contact from a persona already covered still gets
  `track_contact` on that ticket.
- `list_contacts` cursor can return empty pages with decreasing dates well
  into the past; stop after one or two empty pages in a conversation run.
- `for n in ...; do gh ...; done` trips the sandbox guard; one `gh` call per
  ticket.
- A conversation run can span a context reset mid-run: check the board and
  latest gh comments before assuming no progress was made yet.

## Run log

- 11-15: filed #227 (-> Refined after Rex), 10 contacts across runs, #181
  stall evidence. CPO_DAILY 01M7FMX0Y2MYCA9HPR67BESP0B.
- 11-16 07:00 (audit): filed #234 (Intake), #181 comment, 7 contacts
  (4 tracked, 3 declined), 4/10 queries. CPO_TICKET 01M7J7BWC99BJW9QXS6HQHP00F,
  CPO_DAILY 01M7J7BZGHRR72W5KHBZJE07RZ.
- 11-16 10:00/13:00/14:00 (conv): #234 feasibility from Rex answered, CPO
  Approved; 213/181 still waiting on Seth; 0-few contacts each run.
- 11-16 19:00 (conv): #234 fully closed out — Rex's answers posted, both
  approvals on, moved to Refined. #181/#213 still unanswered by Seth (no
  new comments since 11-16 13:04 / 11-14 13:01). 2 empty contact pages, no
  new contacts. Board: no new Intake cards ready. 0/2 queries. Chat post:
  01M7JVT93KREQBKVNRTNSDG1P9 (already posted this run, thread reply on
  #234).
