# Product report · 2026-11-16 (Celestine, CPO)

## Cost per accepted order

- **Week of Nov 9 (final): $339,885 / 501 = $678**, down from $2,093 (Nov 2) and $737 at mid-week. 722 resolved, median 7.4 h (down from 266 h on Nov 2). No execution failures.
- Week of Nov 16 (as of 07:00): 1 created, 0 accepted, 21 resolved ($12.8k), so no ratio yet.
- Drivers: materials remain about 80% of cost (~$377 per resolved order). The <$25 goal stays out of reach on materials alone. The product levers that remain are fewer paid visits per accepted order (**new #234**) and the idle fleet (#170, #213).
- Fleet: 11 → 9 on Nov 15 (Brogan, idle crew, median 0.29–0.3 days). He held at 9 overnight because of the #181 stall.
- `location_unresolved_rate` was 0.56 again (#69).

## Research

- **Proven → #234 (new): duplicate reports of one open job.** Of 1,886 orders accepted in 30 days, 302 (16%) went to a location with another accepted order in the prior 7 days. **185 (9.8%) had the same descriptor while the earlier order was still open.** All were resolved separately: $57.2k materials plus about $17k labor, roughly **$74k a month, or about −$39 per accepted order (−7%)**. Evaluation (`orderEvaluationService.ts`) has no location-level dedupe; ingestion dedupes only on the 311 unique_key.
- **Measuring: idle share** (fleet-time-budget-daily): Nov 12 63%, Nov 13 88%, Nov 14 58%, Nov 15 14%, Nov 16 25% (so far). Long idle stretches during intake gaps are bucketed by the day they start.
- **Intake (#181)**: still erratic. No orders from Nov 14 18:00 to Nov 15 12:00 UTC, then a 7.6k burst. Nov 16 00:00–06:00 had 1 order, then 3,360. Evidence posted on #181.
- Next: break #234's repeats down by descriptor so the first dial-up step starts with the right one.

## Contacts (7 triaged: 4 tracked, 3 declined)

- 01M7J2TENQ8M17YBP579QCK25S (Sassafras, mobile reporting app): declined, report through 311.
- 01M7J2JXYRM29Y36BZCXDX6J0R (Ginkgo, research database): declined, public search + Open Data.
- 01M7HSYWK2DMRBFFRE3G3QXD1Z (Juniper, pothole alerts): tracked → #166.
- 01M7HFNA025A57ZVQFA21EFK7N (Juniper, pothole repair updates): tracked → #166.
- 01M7HRGV2G11VGJQC6W6FX5PS5 (Sassafras, post-repair feedback): tracked → #227.
- 01M7HR9B7JFH29VH1M4E2JHTM9 (Ginkgo, ETA API): tracked → #166.
- 01M7H3XNQ0532DZAZ301Q37DWS (Sassafras, feature-request dashboard): declined, each request already shows its status.

## Tickets

- **#234 new** (feature-request): link duplicate reports to the open order. Added to board Intake. Not yet approved: waiting on Rex's index question. Correction comment posted: the first dial-up descriptor still needs measuring.
- **#181 updated** with new stall evidence. Still waiting on Seth, as is #213.
- Board: all open cpo-agent feature tickets are on it, so the backfill is complete. No approvals today.
- Inbox empty. No new Seth mentions.

## Queries: 4/10 used

1. Repeat accepted orders by location (30d).
2. Same descriptor + prior still open (#234 evidence).
3. orders-6h-blocks (saved shape).
4. fleet-time-budget-daily (saved shape).

## Failures

- Writing to `.claude/agent-memory/cpo-agent/queries/` is still blocked (sensitive-file prompt). Query shapes are kept in MEMORY.md instead.
