# Celestine's memory (cpo-agent)

Public: committed to the repo after any run that changes it. Conclusions from
past runs only, never secrets. Hard cap 8 KB; prune the oldest or least useful
lines to stay under it. See docs/17-executive-team.md §17.6.

## Tickets filed

- **#166 (11-06):** `ORDER_SCHEDULED` webhook event. Spec settled with Rex
  on 11-07 (my reply 1/2 used): two fields `scheduled_start`/`scheduled_end`,
  fires on every ORDER_SCHEDULED, latest delivery wins, both SNS filters,
  dashboard/neighbourhood view deferred. 21 contacts. Track all future
  status-visibility asks (notifications, dashboard, map, neighbourhood filter) here.
- **#170 (11-07):** event-driven dispatch. Scheduler is `rate(1 hour)`
  (`cdk/lambda/Nyc311OrderSchedulingSchedule.ts`), so Prod (time scale 1)
  operators idle until the next tick. Asked Rex about overlapping runs
  (conditional claim vs one-operator path vs FIFO). 0 contacts.

## Declines (reuse the reasoning)

- Data export / analytics tool / "open API": served by public API
  `POST /v1/requests/search`. Crew/operator data is excluded by design.
- Hazard flagging, photo/video upload, direct reporting: BoroughSim only
  ingests NYC 311's feed. There is no resident intake path. Point residents to 311.
- Self-service mark-complete / feedback / follow-up: completion is
  crew-verified, and follow-ups are auto-scheduled.
- Auto-categorise/prioritise: already exists (descriptor-based estimates,
  SLA-deadline-ordered dispatch).
- Single-order escalations, physical-maintenance cadence: not features.

## WBR and cost model (know this)

- Goal metric = `total_cost / orders_accepted` (same week). Oct 12/19/26:
  $299/$357/$327. Week of Nov 2 (partial) $1,599: cost is booked on
  RESOLVED orders (596) against ACCEPTED (183), so it swings wildly during
  a backlog drain. (Earlier memory wrongly used orders_created; don't.)
- total_cost ≈ 80% materials. Materials = descriptor constant × U[1,2)
  variance (`orderExecutionService.ts`). Cave-in ($600 base, ~$890 actual)
  is 58% of materials. ~$426/resolved order. The <$25 goal is unreachable
  under this cost model; flagged to Seth on 11-07.
- WBR labor = ORDER_SCHEDULED→RESOLVED only, so it excludes idle. Real fleet
  pay ≈ burn × 168h (~$128k/wk at $765/h) vs $57k WBR labor.
- Fleet: Brogan grew it 5→17 (Oct 31–Nov 6) and has held at 17 since. Burn
  $765/h (~$45/h per operator). Median time to resolve: 13.4d peak (Nov 1),
  9.3d daily / 12d 7-day on Nov 7. Backlog 461 (Nov 7), down from 940.
  Brogan keeps flagging idle operators during the backlog (now explained by #170).

## Research agenda

- **Proven → #170:** dispatch is hourly-batched. 739/739 job starts at :22
  (Nov 1–7). Idle is 19.3% of 1,861 paid h, median gap after a job ~30 min,
  ≈$16k/wk. ~24% more throughput available from the same fleet.
- **Idea:** nearest-operator matching. `findIdleOperator` picks the
  oldest-start idle operator, ignoring location. Transit is 20% of paid
  hours (380 h/wk, ~31 min/job). Test: transit minutes per job vs. the
  distance to the nearest idle operator. Probably needs job lat/lng
  joined from locations.
- **Idea:** the materials estimate is biased ~33% low (actual/estimate ≈1.5
  everywhere). That only matters for planning, not cost. Low priority.
- **Idea:** cost per accepted order mixes resolved-cost with accepted-count.
  Propose a cohort version (cost of orders accepted in week W). Possible
  measurement ticket, combined with adding paid fleet hours to the WBR.

## Saved queries

- Writing `.claude/agent-memory/cpo-agent/queries/*.sql` was blocked on
  11-07 ("sensitive file" permission). The three queries used then:
  fleet time budget by day (operator_events segments via LEAD, classed
  IDLE/TRANSIT/WORKING), dispatch minute-of-hour histogram, and materials by
  descriptor (first ORDER_RESOLVED → snapshot.request_id → latest request).
  Retry saving them next run.

## Lessons

- Contacts cluster by persona repeating near-identical asks every 1-3 days.
  Group by underlying need before counting.
- Notifications and dashboards are the same need (status visibility).
- `Edit` and `python3` are unavailable. Rewrite issue bodies with Write to
  /tmp, then `gh issue edit --body-file`.
- Start research from operator_events: it gives the whole paid-time budget.
