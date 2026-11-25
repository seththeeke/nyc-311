# Product report · Nov 25, 2026 (Celestine, CPO)

## Cost per accepted order
- **Nov 16 week (final): $422** (180,747 / 428), down from $678 the week before. Materials are 81% of cost.
- **Nov 23 week to date (2 days): $956** (108,981 / 114). This is a catch-up artifact, not a trend: 215 orders resolved against 114 accepted, so the cost of last week's backlog lands on this week's small accepted count.
- The $25 goal is still out of reach by the current cost model (materials alone are ~$340 per resolved order; told Seth 11-18). Idle time isn't counted in `total_cost` (#213).

## WBR and fleet
- Intake is back to normal: 9,324 created in 2 days, 269 Street Condition orders, location-unresolved rate 57.6%. No execution failures.
- Fleet: Brogan cut it from 11 to 9 at 23:00 on Nov 24, releasing idle Trucks 9 and 10 because resolved outpaced accepted and the backlog fell to 13.
- Backlog at end of day: 131 (Nov 21) → 113 → 45 → 37 (Nov 24) → 25 (Nov 25 so far).

## Research agenda
- **SLA attainment: confirmed recovering on a full-intake day.** On Nov 24 (90 accepted), 77 of 98 resolved orders were done within 24 h of acceptance. That compares with 0 of 250 on Nov 19–23. Nov 25 so far: 39 of 39. Accepted-to-resolved p50 fell from 49.7 h to 9.2 h.
- **New report: accept-to-schedule wait.** Orders accepted on Nov 24 waited a p50 of 280 min (p90 580) for an operator. Only 16 of 90 were scheduled within 1 h, and 52 waited over 4 h.
- **Idle-with-backlog (#170), at the smaller backlog.** Since Nov 23, 216 of 225 idle gaps began with accepted, unscheduled orders waiting. That's 116 of 141 idle hours (~$5.2k at $45/h). The gap p50 is 28–34 min, which matches the hourly scheduling run. On Nov 24, idle reached 26.8% of paid time, and 73% of those idle hours had orders waiting. The idle Brogan sees is largely caused by the product, not surplus. I shared this in chat rather than adding a 5th comment to #170, because the regime (fleet 11, small backlog) matches yesterday's comment.
- **Fleet time budget:** idle 17–27%, transit 17–23%, work 55–64% (Nov 22–25).
- Held: SLA-feasible-first; re-complaint rate (waits on #227).

## Contacts
- None in RECEIVED (both pages empty). Nothing triaged.

## Tickets and board
- No new tickets; nothing cleared the bar beyond existing #170.
- Inbox empty; no new Seth `@Celestine` mentions past my latest comments.
- Board: Intake #181 and #244 unchanged (both cpo-approved, waiting on others). All open cpo-agent feature requests are on the board. The backfill is complete.

## Queries (4/10)
1. backlog + SLA daily (report)
2. fleet-time-budget-daily (report)
3. accept-to-schedule wait daily (new)
4. idle-with-backlog since Nov 23

## Failures
- Writing a saved query to `.claude/agent-memory/cpo-agent/queries/` was blocked again as a "sensitive file". The query shapes are kept in MEMORY.md instead.
