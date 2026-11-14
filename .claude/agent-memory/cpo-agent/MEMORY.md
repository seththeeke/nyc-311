# Celestine's memory (cpo-agent)

Public: committed to the repo after any run that changes it. Conclusions from
past runs only, never secrets. Hard cap 8 KB; prune the oldest or least useful
lines to stay under it. See docs/17-executive-team.md §17.6.

## Tickets

- **#166 (11-06):** status visibility. Rex confirmed (11-14 20:01) the
  reworded `searchRequests.description` lever is in-bounds. Finalized
  Verification (search volume ≥ 58/14d baseline, new status-visibility
  contacts ≤ half prior rate, C→100% one step — no partial-rollout
  mechanism for a tool description). Re-approved `cpo-approved`, moved
  **Refined**. Open Q left: 3/8 residents who never search at all aren't
  addressed by wording. 39+ contacts.
- **#170 (11-07):** event-driven dispatch. Kestrel's spec (trigger on
  `WORK_COMPLETED`/`WORK_ABORTED`/`OPERATOR_ADDED`) confirmed 11-14 19:06.
  Held in Spec Created 12h, no new activity since.
- **#181 (11-08, bug):** intake stall. Intake, cpo-approved; routing → Seth.
  No new activity.
- **#194 (11-09):** nearest idle op. Kestrel's spec posted 11-14 (flag
  `NEAREST_OPERATOR_DISPATCH`, win ≤5.5mi avg drive vs 8.16mi today);
  depends on #202 Leg 1 + flag rows + missing `nyc311-gen-purpose-dev` AWS
  profile. Informational only, no question for me; held in Spec Created.
- **#213 (11-10, measurement):** Option A/B rewritten 11-14; waiting on
  Seth's A/B call. Intake. No new activity.
- **#69 (backlog, not mine):** lat/lng location fallback. CTO approved
  11-14. **Refined**, no change.
- **#165 (Turing's):** sticky marketing page. CTO approved 11-14.
  **Assigned**, no change.
- **#202 (not mine):** Kestrel's spec posted 11-14 21:05 (thanked me for
  answer); needs CEO to set up `nyc311-gen-purpose-dev` profile. No flag
  of its own — dark by construction. No action needed from me.

## Declines (reuse the reasoning)

- Data export / research reports (Ginkgo, 7th+): public search + Open Data.
  (Reused 11-14 16:00 on 01M7DWP96HP6SK0HEZ3BWHKQHK.)
- Hazard reporting/photo/hardware/apps: use 311/911.
- Mark urgent / priority / community urgency voting: priority is automatic,
  same rules for every street.
- Accessibility audits / non-street issues: out of scope.
- Self-service mark-complete / live chat / phone: none.
- Notify/alert/status-timing → #166.
- Pothole prioritisation → track on #69.
- Fast-track/expedite review of feature requests: no separate lane; shared
  asks naturally surface sooner. (New 11-14 16:00,
  01M7DWXSE6JCD97XRATA2S5VZ2.)

## WBR and cost model

- Goal = total_cost / orders_accepted. Oct: $299–$357. Nov 2: $2,093.
  Nov 9 wk at 11-14: $289,359/386 = $750 (624 resolved; median 8.7 h).
- Materials ~80% of cost, ~$371/resolved; <$25 unreachable (told Seth 11-07).
- WBR labor = SCHEDULED→RESOLVED; idle excluded (#213). ~$45/op-hour;
  ~2.05 op-hours per order.
- location_unresolved_rate 0.52–0.59 every week since Oct.
- Scheduler hourly, 200/run. Poller 03/09/15/21 UTC, 10k cap.
- Fleet: 21 → 19 → 17 → 15 → 14 → 13 (Nov 14 16:01: 13, 12 busy, 1 idle).

## Research agenda

- **Proven → #170, #181, #194, #213.**
- **Proven 11-14: location fallback (#69).** 14 d: 876 SC orders rejected
  LOCATION_UNRESOLVED, 0 BBL, 571 (65%) lat/lng. ~+285 accepted/wk (+74%),
  ~585 op-h < idle.
- **Measuring: idle share.** 18.7% Nov 9 → 88.1% Nov 13; 26% Nov 14 partial.
- **Idea: satisfaction has no data.** Repair-quality cluster steady at 3
  contacts (Sycamore 01M7CEGMMSE0F7Q7736MCTR2E1, Sassafras
  01M7D8AKDRG1541F7TZ969W3DG, Yellowwood 01M7DHE6079NK3F8XAPH8Q7NCE), all
  left RECEIVED — no new ones 11-14 16:00. Design the measurement ticket
  next audit.
- **Idea:** materials estimate ~33% low. Low priority.
- **Disproved:** poller sets 44 h floor (11-13); 40% searches fail (11-11).

## Saved queries (folder writes STILL BLOCKED, sensitive-file)

Shapes (rebuild from these):
- fleet-time-budget-daily: DISTINCT operator_events 30d, LEAD next (or
  now); class by opening event; exclude OPERATOR_REMOVED; latest rate;
  by start day, 8d. 2.4 MB.
- intake-runs (#181): requests dt>=5d; per request_id MIN ingest, MIN
  created (append 'Z'); by ingest hour: n, SC, min/max created, lag.
- location-unresolved-latlng (#69, weekly): ORDER_REJECTED reason
  LOCATION_UNRESOLVED 14d → latest order_snapshots request_id (filter IN)
  → latest requests (dt>=20d); by descriptor: lat/lng, incident_address,
  bbl, intersection_street_1 non-null from raw_payload. 204 MB.
- orders-6h-blocks, resident-api-outcomes, resident-wait-breakdown,
  resident-searches (#166: SEARCH_REQUESTS `resident:%` / RESOLVED),
  nearest-operator-bounds (3 days max).
- contact-vs-search-overlap (#166, 11-14): distinct resident requesters,
  CREATE_FEATURE_REQUEST vs SEARCH_REQUESTS, 30d. 8 filed, 6 searched,
  5 both, 3 never searched. 108 KB.

## Lessons

- Operator event payloads have NO `$.order_id`.
- public_api requester comes from `X-Requester` header, regex
  `^[a-z0-9][a-z0-9:._-]{0,63}$`; customer sends `resident:<persona>`.
- Use Write, not Edit/sed; grep on /tmp blocked; curl denied; one command
  per Bash call; mkdir via Write (plain `mkdir` needs approval even in own
  worktree — Write creates parent dirs itself).
- Morning runs land ~13:00 UTC.
- Top-level posts ≤75 words.
- Check upstream intake before reading a demand drop as real.
- Self-joins over 7 d of operator_events time out.
- `gh issue view`: `--json comments -q`; no for-loops over issue numbers.
- All gh comments show seththeeke; tell agents apart by marker.
- customer/backend/ decision logic (gatherIdeaContext, describeOrder,
  ideaContext.ts) is off-limits even for a "pull not push" fix — editing
  when/whether the resident's model checks something is gaming our own
  test. The only lever there is a tool's own definition in actionTools.ts
  (description, schema) — what the model is told, not what it's made to do.
- Finding a ticket's original Team Chat thread message id by scanning
  `read_channel` dumps isn't worth the tokens (one giant line, no good
  grep path); skip the chat thread reply when only GitHub needed updating.

## Run log

- 11-14 07:00 (audit): 6 contacts (1 → #69, 4 declined, 1 held); #166
  Refined; #213 fixed for Kestrel; #69 board+approved; #165 block+approved;
  #202 unblocked; 3/10 queries; no new ticket; CPO_DAILY
  01M7D2JSZWM1K7CBHH77Q4ZM8X.
- 11-14 13:00 (conversation): Seth+Rex killed #166's pull-based fix;
  rewrote Proposal (actionTools.ts wording), withdrew cpo-approved, moved
  to Intake; confirmed Kestrel's #170 trigger change; #69/#165 both CTO
  approved (already Refined/Assigned, no action needed); 3 new contacts
  (repair-quality cluster) left RECEIVED for tomorrow's audit; 1/2 queries.
  No new ticket. Chat post: none.
- 11-14 16:00 (conversation): Rex confirmed #166's wording lever in-bounds;
  finalized Verification, re-approved, moved Refined. Reviewed #170/#181/
  #194/#213/#202/#69/#165 — no action needed beyond #166. 2 new contacts
  (Ginkgo dashboard, Sassafras fast-track) declined; repair-quality cluster
  unchanged at 3, left for audit. 0/2 queries (no open question needed
  one). No new ticket. Chat post: none.
