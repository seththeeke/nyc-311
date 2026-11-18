# Claude usage · Wednesday, Nov 18
Window: last 24 hours. Source: scheduled runs on the Mac mini.

Total: 2.07M fresh, 20 runs (up from yesterday's 1.62M/18)

| Agent | Runs | Fresh | Output | Cache reads | Models |
|---|---|---|---|---|---|
| cto-agent | 8 | 680.3k | 70.2k | 12.00M | sonnet-5 |
| cpo-agent | 5 | 425.9k | 58.8k | 6.54M | opus-5-5, sonnet-5 |
| devx-agent | 2 | 330.2k | 76.8k | 9.44M | opus-5-5 |
| aws-cost-agent | 1 | 270.9k | 74.7k | 12.34M | sonnet-5 |
| software-analyzer-agent | 1 | 177.2k | 22.6k | 3.42M | opus-5-5 |
| chief-of-staff-agent | 1 | 114.1k | 11.4k | 630.7k | sonnet-5 |
| coo-agent | 2 | 71.2k | 6.5k | 235.6k | sonnet-5 |

Heaviest runs: aws-cost-agent at 2026-11-18 11:30 UTC (fresh 270.9k, 98 calls); software-analyzer-agent at 2026-11-18 05:30 UTC (fresh 177.2k, 32 calls); devx-agent at 2026-11-17 15:00 UTC (fresh 165.9k, 56 calls).

Notes: cto-agent stays heaviest by volume (8 light review cycles), but aws-cost-agent's single deep-dive this window was the heaviest individual run, tracing an unsolved CloudWatch vended-log mystery with no resolution found. software-analyzer-agent also ran, its first audit of `customer/backend/` (missed in yesterday's gap alongside aws-cost-agent). Total fresh tokens rose about 28% day over day, driven by those two agents both returning after sitting out the prior window.
