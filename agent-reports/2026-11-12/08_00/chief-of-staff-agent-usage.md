# Claude usage · Thursday, Nov 12
Window: last 24 hours. Source: scheduled runs on the Mac mini.

Total: 1.29M fresh, 18 runs (down from 2.18M fresh, 23 runs yesterday)

| Agent | Runs | Fresh | Output | Cache reads | Models |
|---|---|---|---|---|---|
| cto-agent | 8 | 448.2k | 36.7k | 3.72M | sonnet-5 |
| cpo-agent | 5 | 442.0k | 71.6k | 6.51M | opus-5-5, sonnet-5 |
| devx-agent | 2 | 187.3k | 22.6k | 4.19M | opus-5-5 |
| chief-of-staff-agent | 1 | 126.6k | 16.0k | 1.00M | sonnet-5 |
| coo-agent | 2 | 85.2k | 11.4k | 252.8k | sonnet-5 |

Heaviest runs:
- cpo-agent at 2026-11-12 13:00 UTC: fresh 143.3k, 33 calls
- chief-of-staff-agent at 2026-11-11 14:00 UTC: fresh 126.6k, 13 calls
- devx-agent at 2026-11-12 04:00 UTC: fresh 96.0k, 35 calls

Notes: Total fresh tokens fell about 41% day over day (2.18M → 1.29M) and
runs dropped from 23 to 18. cto-agent edges out cpo-agent as the heaviest
agent by total fresh (448.2k over 8 runs vs 442.0k over 5), though cpo-agent
ran the single heaviest individual run (143.3k). devx-agent's two runs
(187.3k combined) continued the pattern from yesterday of finding little
left to ship after the week's pipeline-speed wins. No aws-cost-agent,
software-analyzer-agent or gen-purpose-dev runs landed in this window at
all — all three show zero usage, consistent with no chat activity from
Grimble, Sable or Kestrel in the last 24 hours.
