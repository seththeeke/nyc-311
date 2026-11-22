# Product report · Nov 22, 2026 (Celestine, CPO)

## Cost per accepted order
- **Nov 16 week (final, 7 days): $409** (149,217 / 365). Labor $28.7k (19%), materials $120.5k (81%). Prior weeks: $678 (Nov 9), $2,093 (Nov 2).
- The $25 goal is still out of reach while materials run ~$330 per accepted order. Labor is the lever the product controls: about $79 per accepted order.
- Intake is back after the stall (#181): 63 orders accepted on Nov 21 and 45 so far on Nov 22. Resolved: 290 orders, median 24.9 h from creation to resolution (up from 7.4 h).

## Fleet and backlog (saved reports)
- Fleet: 7 → 9 operators (Brogan recruited 2 on Nov 21 23:00, hiring ahead of the burst).
- **backlog-age-daily:** backlog at end of day was 129 (Nov 20), 131 (Nov 21) and 140 now. p90 age 32 → 38 → 49.7 h. Acceptance-to-resolution p50 for each day's resolved orders: 41.9 → 43.2 → 47.6 h.
- **fleet-time-budget-daily:** idle 17–20% and driving 17–25% of paid hours, Nov 18–22, with 130+ orders waiting. Work share is 62–65%.

## Research agenda
- **Proven → #253 (new):** under backlog, operators drive to the single oldest order anywhere in the city. Across 177 trips since Nov 19, every trip had 10+ orders waiting (p50 114). The average drive was **8.09 mi**, against **2.89 mi** to the nearest of the 10 oldest (0.84 mi to the nearest of any). Average drive time is 14.8 min for 1–3 mi, 28.8 min for 6–10 mi and 50.5 min for 10+ mi. Expected saving: 12–14 min per job, about 80–90 paid h a week, **about $9–10 per accepted order**, and about 9–10% more throughput from the same fleet.
- #194 (nearest operator) only helps when idle operators outnumber orders. I commented there that #253 covers the backlog case and replaces #194's point 4.
- Idle-with-backlog (#170) still holds: idle is 17–20% while orders wait.
- SLA attainment: still in Measuring, with TTR p50 near 48 h. I'll check again after #170 and #253.

## Tickets
- **#253 new** (feature): nearest of the N oldest waiting orders. On the board in Intake, CPO approved, waiting on Rex.
- #194 commented (cross-link). #227 +2 contacts, #166 +1 contact.

## Contacts (4 triaged)
- 01M81BZZ88X46MV4AS15JW3971: tracked → #166 (stage timeline)
- 01M816NPA5Q6VKE4XNR7HZKEXA: tracked → #227 (repair feedback)
- 01M80WKJRZH348KJTF9VAXCKFP: tracked → #227 (feedback; reporting goes through 311)
- 01M81GZ95E895PWWZ8ZQYJ5QG3: declined (crew-performance research API; NYC Open Data and public search cover it)

## Inbox, mentions, board
- Inbox: 1 Brogan ack in my Nov 21 thread (recruiting 2). No reply needed.
- Seth mentions: none new.
- Board: added and approved #253. No other Intake card is ready (#181 and #244 have no cto-approved). Backfill is complete.

## Queries: 4/10
backlog-age-daily, fleet-time-budget-daily, backlog-dispatch-distance (new), drive-minutes-by-distance (new).

## Tool failures
Writes to the saved-queries folder are still blocked (sensitive-file permission), so the query shapes are kept in MEMORY.md.
