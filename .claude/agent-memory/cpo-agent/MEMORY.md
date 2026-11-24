# Celestine's memory (cpo-agent)

Public: committed to the repo after any run that changes it. Conclusions from
past runs only, never secrets. Hard cap 8 KB; prune the oldest or least useful
lines to stay under it. See docs/17-executive-team.md §17.6.

## Tickets

- **#253 (11-22):** under backlog, freed op takes nearest of N=10 oldest
  waiting (skip cap K=3, SLA-overdue first). 8.09 mi actual vs 2.89 top-10.
  ~$9-10/acc. Refined (cpo+cto approved). Depends on #202.
- **#244 (11-18, bug):** window too short; W=2.0 env/SSM. 2/2 Rex replies
  used. Intake, cpo-approved, no cto-approved. Routed straight to Pip; stays
  in Intake (no remove command).
- **#234** dup linking, **#227** repair feedback (21+ contacts), **#166**
  status visibility (67+ contacts): all Refined.
- **#170** event-driven dispatch, **#194** nearest idle op: Spec Created.
  #170 evidence comments: 11-19, 11-20, 11-21, 11-24 (fleet 11: 237/237
  gaps, 114.5 h, ~$46/acc, +22%). Don't add more unless the regime changes.
- **#181 (bug):** intake stall. cto-escalated, waiting on Seth. straight to
  Pip. Don't ping.
- **#213 (measurement):** idle in WBR. Refined. Option A confirmed by Seth;
  watch first post-ship WBR vs fleet-time-budget-daily within 2%.
- **#69 (Rex's, I approved + metric block):** lat/lng location fallback.
  Refined. 784/1,262 loc-rejects (62%) have lat/lng; ≈ +5 ops of load.
- **#202 (not mine):** backend flag read; #253/#194/#170/#69 depend on it.

## Declines (reuse the reasoning)

- Data export / research APIs / crew performance data / analytics
  dashboards / community map: NYC Open Data + public search.
- Crowd-sourced status updates: ours are operator-tracked; -> #166.
- Hazard reporting / detection / apps / photo / hardware / route-safety /
  navigation alerts: report via 311 (911 if danger); own-report status ->
  #166.
- Mark urgent / priority / voting: automatic; every report gets a visit.
- Accessibility audits / non-street issues: out of scope.
- Self-service mark-complete / live chat / phone: none.
- Community discussion space: out of scope; point to #166 + #227.
- Feature-request dashboard / fast-track review / third-party routing: no.
- Proactive/scheduled maintenance: we only dispatch on filed 311 reports.
- Audit trail / notification prefs / ETA / stage timeline -> #166;
  photo / before-after / quality feedback -> #227; citywide repair map
  declined.

## WBR and cost model

- Goal = total_cost / orders_accepted. Oct $299-357; Nov 2 $2,093; Nov 9
  $678; Nov 16 wk final $422 (180,747/428), materials 81%. Nov 23 wk day 1
  $1,312 (121 resolved vs 50 accepted, catch-up; not a trend).
- **$25 goal structurally unreachable** (told Seth 11-18). Materials
  ~$340/resolved alone.
- Materials = constant per descriptor x processing variance; wait does NOT
  raise materials. Only fewer jobs lower it (#234, #227).
- WBR labor = SCHEDULED->RESOLVED (incl. drive); idle excluded (#213).
  Idle ≈ +$46/accepted (Nov 22-24) unseen. Op rate $45/h (all 11).
- SLA: accepted+24h, all STANDARD; scheduler = FIFO by sla_deadline,
  MAX_ORDERS_PER_RUN 200 (not binding). Scheduling == dispatch (0 h gap).
- Removal is clean (queued removal finalizes at WORK_COMPLETED): no drain
  waste.
- Fleet: 21 -> 3 (Nov 19) -> 7 -> 9 -> 10 -> 11 (Nov 22 23:00), held at 11
  through Nov 24. Brogan holding at 11 past Thanksgiving dip (11-24 16:01):
  demand itself thin (24 accepted, 9/11 idle that day), watching 1-2 more
  days before touching headcount.
- Intake is bursty (~2-4.5k created / 20-50 accepted per block); gaps
  18:00 11-22 -> 21:00 11-23 again. Told Brogan (11-23, 11-24) not to read
  a backlog drop driven by missing intake as steady state; he's heeding it.
- Run time: "07:00" audit runs ~13:00 UTC; WBR job 07:00 UTC.

## Research agenda

- **Proven -> #253, #170, #181, #194, #213, #69, #227, #234, #244.**
- **Measuring: backlog-age-daily:** eod 131 (11-21) -> 113 -> 45 -> 11
  (11-24 partial); acc->res p50 49.7 h (11-22) -> 35.3 -> 10.9.
- **Measuring: fleet time budget:** Nov 18-24 idle 17-21%, transit 17-25%,
  work 58-64%. After #253 transit target <=12%.
- **Measuring: SLA attainment:** 0/250 within 24h Nov 19-23; 39/60 on
  11-24 (low intake). Confirm on a full-intake day.
- **Idea, held:** SLA-feasible-first vs strict FIFO; matters less at
  backlog ~11. Revisit after #253/#170 ship.
- **Idea:** re-complaint after resolve 4.1%/14d: revisit when #227 ships.
- **Next:** after #213, cost incl. idle; after #244, window accuracy
  >=98%; after #170, idle-with-backlog -> ~0.
- **Disproved:** materials mix as lever; wait inflates materials (code);
  poller 44h floor; 40% searches fail; scheduled->dispatch queue (0 h);
  removal drain waste (code).

## Saved queries (folder writes STILL BLOCKED, sensitive-file; 11-24 too)

Shapes (rebuild from these):
- backlog+sla daily (combined, 1 query): per order min ACC / min
  RESOLVED|FAILED / min CREATED (45d); days UNNEST(sequence(cur-9d..today));
  eod = least(d+1, now); backlog, age p50/p90, accepted, resolved,
  within 1440 min, acc->res p50, TTR p50.
- fleet-time-budget-daily: DISTINCT operator_events 30d, LEAD next (or
  now); class by opening event; exclude OPERATOR_REMOVED; by start day.
- intake-3h-blocks (+ active op count/avg rate via latest
  operator_snapshots CROSS JOIN): created/accepted/resolved per 3h, 72h.
- idle-with-backlog: gaps WORK_COMPLETED/ABORTED/OPERATOR_ADDED -> next
  event; LEFT JOIN orders acc < s AND (sch NULL or > s) AND not done.
- location-reject-payload (#69), backlog-dispatch-distance (#253),
  scheduled-window-accuracy (#244), materials-by-descriptor,
  repeat-by-descriptor (#234).

## Lessons

- Operator event payloads have `$.location` but NO `$.order_id`.
- Satisfaction lives customer-side; never read it.
- Use Write, not Edit, sed or python; rewrite whole files. Write creates
  report folder; mkdir is blocked.
- Don't run a gh command in parallel with the Write of its body file.
- `gh issue view` takes --comments OR --json, not both; `gh api` blocked.
- Don't assert unmeasured facts in a ticket body; measure first.
- Top-level posts <=75 words; aim for 65 (76 rejected 11-24).
- Check upstream intake before reading a demand (or backlog) drop as real.
- `gh`: one call per issue; for-loops blocked.
- All gh comments show seththeeke; tell agents apart by marker.
- `list_contacts`: page once with cursor; stop at empty/null.
- Read the simulation code before blaming the product.
- Board has no remove command; off-board bugs stay in Intake harmlessly.
- New evidence on an existing ticket = comment; a distinct regime = new
  ticket + cross-link.
- Fleet-sizing judgment is Brogan's: share signal in chat, not a ticket.
- A cto-agent feasibility comment != cto-approved label; check the label.
- Settled threads (no Seth comment past my own reply) need no gh comment.

## Run log

- 11-23 07:00 (audit): no new ticket; #69 evidence; 2 contacts -> #166;
  5/10 q; CPO_DAILY 01M8483D2KWZZ8EK0EMHFB1QHD.
- 11-23 10:00/16:00 (convs): 4 contacts (2 declined, 2 tracked), 0 q, no
  posts.
- 11-24 07:00 (audit): no new ticket; #170 + #227 comments; 3 contacts (2
  -> #227, 1 declined); 4/10 q; CPO_DAILY 01M86TE1313C4Q0S66412HYBJQ.
- 11-24 10:00 (conv): nothing new since 07:00 audit — inbox empty, no new
  Seth comments on #170/#227 etc, 0 new contacts, board unchanged, 0 q,
  no post.
- 11-24 13:00 (conv): Brogan acked the intake-lull heads-up, holding fleet
  at 11 through the dip; nothing new on #170/#227 past my own comments, 0
  new contacts, Intake board unchanged (#181, #244), 0 q, no post.
- 11-24 16:00 (conv): inbox empty, no new Seth comments on open tickets
  (170/227/181 checked, all settled on my own latest comment); 1 new
  contact (01M87MX0...FP2, before/after repair feedback) -> tracked on
  #227 (now 21+); board Intake unchanged (#181, #244); 0 q, no post.
