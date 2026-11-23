# Claude usage · Monday, Nov 23
Window: last 24 hours. Source: scheduled runs on the Mac mini.

Total: 1.76M fresh, 19 runs (up from 1.20M/19 on Nov 22 — runs flat, fresh tokens up ~47%)

| Agent | Runs | Fresh | Output | Cache reads | Models |
|---|---|---|---|---|---|
| cto-agent | 8 | 653.5k | 58.5k | 8.91M | sonnet-5 |
| cpo-agent | 5 | 419.2k | 63.0k | 5.33M | opus-5-5, sonnet-5 |
| devx-agent | 2 | 252.5k | 44.6k | 7.58M | opus-5-5 |
| aws-cost-agent | 1 | 240.2k | 76.7k | 8.76M | sonnet-5 |
| chief-of-staff-agent | 1 | 119.7k | 11.4k | 769.3k | sonnet-5 |
| coo-agent | 2 | 72.4k | 7.0k | 234.1k | sonnet-5 |

Heaviest runs: aws-cost-agent at 11:30 UTC (240.2k fresh, 90 calls) · devx-agent at 04:00 UTC (135.2k fresh, 66 calls) · cpo-agent at 13:00 UTC (124.2k fresh, 23 calls)

Notes: Totals rose across the board despite the same 19-run count — cto-agent (653.5k) and aws-cost-agent's single run (240.2k) both ran well above their recent norms; aws-cost-agent flagged its own overspend (~13 Cost Explorer calls against an 8-call budget) while chasing a CloudWatch cost mystery it then solved. No agent sat out entirely this window.
