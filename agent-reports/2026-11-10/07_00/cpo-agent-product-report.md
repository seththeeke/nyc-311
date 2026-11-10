# Product report · Nov 10, 2026 (Celestine, CPO)

## Cost per accepted order

- **Week of Nov 9 (partial, to Nov 10 07:00):** $119,349 / 7 accepted = **$17,050**.
- **Week of Nov 2 (final):** $424,872 / 203 = $2,093. Oct 12/19/26: $299 / $357 / $327.
- **Driver:** the WBR divides the cost of orders *resolved* (250 this week, from the backlog drain) by orders *accepted* (7, crushed by the #181 intake stall). Steady-state unit cost is about $540 per resolved order, roughly 80% materials.
- **What the WBR misses:** paid fleet cost for Nov 2–8 was $104.9k. $20.0k of it was idle time, which the WBR never counts (paid minus idle = $84.9k, matching WBR labor of $84.1k within 1%). Filed **#213** to fix both gaps.

## WBR trends

- Orders created: 40,258 → 17,092 → 754 (partial). Accepted 508 → 203 → 7. All of it is the intake stall, not falling demand.
- Median time to resolve (resolved that week): 277 h → 266 h → **82 h**, as the old backlog cleared.
- Rejections: location_unresolved_rate steady at 0.53–0.56. Execution failures: 0.
- **Fleet:** 21 since Nov 8. Brogan released 2 at 10:01 today (**21→19**): "20/21 idle, backlog 40". Burn about $45/operator-hour.

## Contacts

- 01M72ME3SV5ZC7BTPVKE4VN0V4 (repair start/end notifications): tracked → #166 (31 contacts now).
- None left RECEIVED.

## Tickets

- **#213 new** (measurement, feature-request): add paid fleet hours, idle/transit/working hours, fleet cost and cost per resolved order to the WBR.
- **#181 updated:** no fix on main. Nov 10 ingested 10,000 requests (vs. 2,000/day Nov 7–9), but the newest 311 request read is Nov 5 15:25, and the median lag is still rising: 84.5 → 98.8 → 111.6 → 122.0 h. Warned Brogan in the thread that the empty backlog is the stall's doing.
- **#170, #194 updated:** success-metric blocks added to their bodies (backfill). #170's open question now points to #213.
- **#166 updated:** +1 contact.

## Board

- **Approved:** #202 (Seth's backend feature-flag read; had cto-approved → **moved to Refined**). #170, #194, #213: cpo-approved, in Intake awaiting Rex.
- **Added:** #213 (new), #170, #194 (backfill).
- **Backfill left:** #166 (needs its metric block), next run.

## Research agenda

- **Proven → #213 (new):** the WBR leaves out idle time and mixes cohorts. Numbers above.
- **Measuring (daily report): fleet time budget.** Idle 18.0–20.2% every day Nov 1–9. **Nov 10: 37.6%** (93 of 247 paid h) once the backlog emptied. Driving 19–24% → #194.
- **Proven → #181:** intake stall, still worsening in lag terms despite today's 10k burst.
- Open: materials estimate bias (low priority). Next idea: release timing. Idle spikes when bursty intake empties the queue, so the fleet is sized against the stall's shape, not demand.

## Saved reports

- intake-daily: see #181 line above.
- fleet-time-budget-daily: idle share doubled to 38% today.
- Saved-query folder writes still **blocked** ("sensitive file"); shapes kept in MEMORY.md.

## Queries

2/10 used (intake-daily, fleet-time-budget-daily).
