# CPO product report · Nov 21, 2026

## Cost per accepted order
**$373** for the Nov 16 week, 6 days in: $112,620 total cost over 302 accepted orders. It was $359 after 5 days, and the Nov 9 week closed at $678. Materials are $90,474 (80%) and labor $22,146. Materials (a fixed amount per descriptor times the simulation's factor) still keep the $25 goal out of reach. The WBR also leaves out idle paid time (#213), so the true figure is higher.

## WBR and fleet
- Fleet went 3 → 5 (Nov 20 04:00) → 7 (Nov 20 16:00); Brogan was holding at 7 at 23:00 with a backlog of 113.
- Daily backlog at end of day was 21 (Nov 17), 67, 116, 129 (Nov 20), and is 97 at 13:00 UTC Nov 21. The p90 age of waiting orders is 39 h. TTR p50 of orders resolved each day went 8.8 h, 25.7 h, 41.9 h, 39.1 h.
- **Intake stalled again:** 3 orders were created in the ~21 h since Nov 20 15:43 UTC, against 2.5k–3.9k per burst before that, and none have been accepted today. Today's drain comes from no new work arriving, not from the fleet catching up. Added to #181.
- Execution failures 0; location_unresolved_rate 0.59.

## Contacts (2 triaged)
- 01M7Y1BA9G3S7DEKYND8G5BCJS: tracked → #166 (alerts when a hazard on a cycling route is fixed; the route-map part is declined, report hazards via 311).
- 01M7XZNSG6E50TFGJZJWA8PSXN: declined (analytics dashboard; NYC Open Data and public search already cover it).

## Tickets
- No new ticket.
- **#170 updated:** since Nov 20 00:00, all 79 idle gaps began with orders waiting (median 119), 40.3 idle h (~one of 7 operators, ~$1.9k). Idle share was 18.0% on Nov 20 and 21.6% on Nov 21 (partial).
- **#181 updated:** the new intake stall, recorded without tagging anyone.
- Board: no change. #244 and #181 are still in Intake (no cto-approved). Backfill is complete.
- Seth mentions: no new ones. Inbox: empty.

## Research agenda
- **New idea, measuring: SLA attainment.** Every order gets the same 24 h SLA and the `STANDARD` tier (`MockOrderPriorityAssigner`), so dispatch is first-in, first-out whatever the hazard. Of the orders resolved in the last 7 days, ~67% made it within 24 h. **In the last 2 days it was 0 of 92.** Cave-ins (29% of recent resolves) wait like faded lines. Ranking by severity would only change who waits, not how many. The SLA collapse comes from capacity and idle time, which #170 addresses. I'm not filing a severity-tier ticket until there's satisfaction evidence by descriptor.
- **Re-proven → #170:** idle-with-backlog, 79/79 gaps.
- **Measuring:** backlog-age-daily and the fleet time budget (drive 18–20%, 29–30 min per trip; work 92–100 min per job).

## Saved reports
Writes to the queries folder are still blocked (sensitive-file). The query shapes are kept in memory.

## Queries
5/10 used: backlog-age-daily, fleet-time-budget-daily, idle-with-backlog (since Nov 20), intake by 3-hour block, sla-attainment-by-descriptor (new).
