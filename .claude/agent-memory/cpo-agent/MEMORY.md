# Celestine's memory (cpo-agent)

Public: committed to the repo after any run that changes it. Conclusions from
past runs only, never secrets. Hard cap 8 KB; prune the oldest or least useful
lines to stay under it. See docs/17-executive-team.md §17.6.

## Tickets

- **#166 (11-06):** status visibility. Seth killed webhook (11-14 00:31);
  rewritten pull-based (gatherIdeaContext refresh). 11-14: added Rex's
  skip-CLOSED + `X-Requester: resident-refresh:*` (keeps metric clean);
  re-approved, **Refined**. 39 contacts. Rex replies 2/2 used.
- **#170 (11-07):** event-driven dispatch. Refined. 2/2.
- **#181 (11-08, bug):** intake stall. 2/2. Intake, cpo-approved; Rex
  declined cto (routing → Seth/Pip). Still stalling 11-14 (two near-empty
  runs, lag 40 h).
- **#194 (11-09):** nearest idle op. Spec Created by Kestrel 11-14; needs #202.
- **#213 (11-10, measurement):** Kestrel pushed back (no flag, who applies
  SQL). 11-14: body rewritten: Option A (flag exemption, CEO applies SQL
  Test→Prod) / B (`wbr_fleet` job); accepted_cohort_cost dropped. NOT
  re-approved — waiting on Seth's A/B call. Rex 2/2 used.
- **#69 (backlog, not mine):** lat/lng location fallback. 11-14: evidence +
  metric block comment, added to board, cpo-approved. Open: Location
  identity (Seth/Rex, §4). Needs #202 flag.
- **#165 (Turing's):** sticky marketing page. 11-14 metric block (browser
  check) + cpo-approved; waits on Rex.
- **#202 (not mine):** 11-14 answered parked Q2: latency baseline "to be
  measured" at first caller's hold. Unblocks #194/#170.

## Declines (reuse the reasoning)

- Data export / research reports (Ginkgo, 7th+): public search + Open Data.
- Hazard reporting/photo/hardware/apps: use 311/911.
- Mark urgent / priority / community urgency voting (Sassafras ×3 11-14):
  priority is automatic, same rules for every street.
- Accessibility audits / non-street issues: out of scope.
- Self-service mark-complete / live chat / phone: none.
- Notify/alert/status-timing → #166.
- Pothole prioritisation → track on #69 (pothole reports rejected for location).

## WBR and cost model

- Goal = total_cost / orders_accepted. Oct: $299–$357. Nov 2: $2,093.
  Nov 9 wk at 11-14: $289,359/386 = $750 (624 resolved; median 8.7 h).
- Materials ~80% of cost, ~$371/resolved; <$25 unreachable (told Seth 11-07).
- WBR labor = SCHEDULED→RESOLVED; idle excluded (#213). ~$45/op-hour;
  ~2.05 op-hours per order.
- location_unresolved_rate 0.52–0.59 every week since Oct.
- Scheduler hourly, 200/run. Poller 03/09/15/21 UTC, 10k cap.
- Fleet: 21 → 19 → 17 → 15 → 14 → 13 (Nov 13 23:00, "14/14 idle").

## Research agenda

- **Proven → #170, #181, #194, #213.**
- **Proven 11-14: location fallback (#69).** 14 d: 876 SC orders rejected
  LOCATION_UNRESOLVED, 0 BBL, 571 (65%) lat/lng, all address/intersection.
  ~+285 accepted/wk (+74%), ~585 op-h < idle.
- **Measuring: idle share.** 18.7% Nov 9; 33.5% Nov 10; 36.6% Nov 11;
  62.8% Nov 12; 88.1% Nov 13; 26% Nov 14 partial (burst arrived).
- **Idea: satisfaction has no data.** Next audit: design measurement
  ticket. Sycamore 01M7CEGMMSE0F7Q7736MCTR2E1 (repair-quality feedback)
  left RECEIVED as candidate signal — decide then.
- **Idea:** materials estimate ~33% low. Low priority.
- **Disproved:** poller sets 44 h floor (11-13); 40% searches fail (11-11).

## Saved queries (folder writes STILL BLOCKED 11-14, sensitive-file)

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

## Lessons

- Operator event payloads have NO `$.order_id`.
- public_api requester comes from `X-Requester` header, regex
  `^[a-z0-9][a-z0-9:._-]{0,63}$`; customer sends `resident:<persona>`.
- Use Write, not Edit/sed; grep on /tmp blocked; curl denied; one command
  per Bash call; mkdir via Write.
- Morning runs land ~13:00 UTC.
- Top-level posts ≤75 words.
- Check upstream intake before reading a demand drop as real.
- Self-joins over 7 d of operator_events time out.
- `gh issue view`: `--json comments -q`; no for-loops over issue numbers.
- All gh comments show seththeeke; tell agents apart by marker.
- Memory can lag a run (11-14 found my own 01:04 #166 reply unlogged):
  read the ticket threads, not just memory.

## Run log

- 11-13 (all runs): Ginkgo, Yellowwood declined; Sycamore → #166; #181
  routing deferred to Seth.
- 11-14 07:00 (audit): 6 contacts (1 → #69, 4 declined, 1 held); #166
  Refined; #213 fixed for Kestrel; #69 board+approved; #165 block+approved;
  #202 unblocked; 3/10 queries; no new ticket; CPO_DAILY
  01M7D2JSZWM1K7CBHH77Q4ZM8X.
