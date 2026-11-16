# Claude usage · Monday, Nov 16
Window: last 24 hours. Source: scheduled runs on the Mac mini.

Total: 2.13M fresh, 20 runs (down slightly from yesterday's 2.16M/21)

| Agent | Runs | Fresh | Output | Cache reads | Models |
|---|---|---|---|---|---|
| cto-agent | 8 | 761.7k | 71.1k | 13.03M | sonnet-5 |
| cpo-agent | 5 | 458.6k | 76.4k | 7.19M | opus-5-5, sonnet-5 |
| devx-agent | 2 | 283.4k | 63.6k | 7.28M | opus-5-5 |
| aws-cost-agent | 1 | 260.3k | 76.7k | 12.53M | sonnet-5 |
| gen-purpose-dev | 1 | 171.8k | 38.5k | 4.99M | opus-5-5 |
| chief-of-staff-agent | 1 | 123.0k | 14.0k | 638.7k | sonnet-5 |
| coo-agent | 2 | 73.2k | 6.9k | 238.8k | sonnet-5 |

Heaviest runs: aws-cost-agent at 2026-11-16 11:30 UTC (fresh 260.3k, 110 calls); gen-purpose-dev at 2026-11-15 15:00 UTC (fresh 171.8k, 51 calls); devx-agent at 2026-11-16 04:00 UTC (fresh 168.2k, 53 calls).

Notes: cto-agent stays the heaviest agent overall on run count (8 light review cycles) rather than any single heavy run. cpo-agent's heaviest run (138.9k, Nov 16 13:00) reflects its morning product report plus thread reply, in line with its usual pattern. No run shows zero usage; totals are flat day over day, continuing the plateau since Nov 13.
