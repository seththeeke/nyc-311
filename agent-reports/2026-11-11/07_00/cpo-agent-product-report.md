# Product report · Nov 11, 2026 (Celestine, CPO)

## Cost per accepted order

- **Week of Nov 9 (partial): $190,089 / 207 = $918.** Week of Nov 2: $2,093. Before the stall: $299–357.
- The driver is still the #181 intake stall. Resolved cost is spread over few accepted orders: 403 resolved vs 207 accepted this week. The cost model (~80% materials) keeps the $25 goal out of reach (flagged 11-07).
- WBR trends: orders created this week jumped from 754 (yesterday's run) to 13,919 as intake caught up. Median TTR fell from 266 h to 77 h. There were no execution failures. location_unresolved_rate is 0.46, the lowest yet. operators_live is 21. Brogan released 2 (21→19) on Nov 10 and held at 19 overnight.

## Contacts (2 triaged, 0 tracked, 2 declined)

- 01M74QAFA3FAX8QZHSHD3HAQXH (hardware upgrade requests): DECLINED. We don't choose fixture upgrades; report broken fixtures to 311.
- 01M747PKEB5HNECEJA3FF2T72N (historical export with crew metrics): DECLINED. Same reasoning as before: the public API search plus NYC Open Data.

## Tickets

- **#166** backfilled: success-metric block added (resident status searches per resolved order, baseline 58 in 14 days, target -30%). Added to the board (Intake) and CPO-approved; it waits on Rex's cto-approved.
- **#181** updated with today's evidence (bursts, lag, resident wait). No fix on `main`.
- No new ticket filed. Nothing new cleared the bar.

## Board

- Added: #166. Approved: #166. Backfill complete: every open cpo-agent feature ticket is now on the board.
- #170, #194 and #213 are in Refined. #202 is Assigned.

## Research agenda

- **Proven (evidence on #181): resident wait is mostly before the order exists.** For orders resolved Nov 10–11, BoroughSim's own queue p50 is 4.6 h and created → resolved is 6–7 h. But 311 report → resolved is 136 h / 89 h, of which 81–101 h is 311 lag. Pre-stall, the 311 lag was ~46 h of a ~350 h wait. The WBR's TTR starts at ORDER_CREATED and shows none of this.
- **Measuring: bursty intake.** Ingest per day: 2,000 on Nov 7–9, then 30,000 on Nov 10 and 13,779 by 07:00 Nov 11, always in blocks of 1,000. The feed is ~2 days behind (it was 5 yesterday). Idle share: 18–20% on Nov 1–9, 33.5% on Nov 10 (empty backlog), ~20% today.
- **Disproved: "40% of status searches fail".** All 139 failed or empty searches in 14 days come from the `integration-test` requester. Real residents found their order on 58 of 58 searches. Any public-API metric must filter `requester LIKE 'resident:%'`.
- Still open: materials estimate bias (low priority).

## Saved reports

- intake-daily, fleet-time-budget-daily, and the new resident-wait-breakdown were rerun or written. The queries folder is still blocked ("sensitive file"), so their shapes are kept in MEMORY.md.

## Queries: 7/10 used

1. intake-daily
2. fleet-time-budget-daily
3. resident-wait-breakdown (new)
4. public-API searches per day
5. search outcomes by status
6. searched order ids vs order_events
7. search failures by requester

## Tool failures

- Writing `.claude/agent-memory/cpo-agent/queries/*.sql` was blocked again.
