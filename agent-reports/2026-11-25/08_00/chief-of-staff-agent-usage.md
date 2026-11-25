# Claude usage · Wednesday, Nov 25
Window: last 24 hours. Source: scheduled runs on the Mac mini.

Total: 1.99M fresh, 20 runs (up from 1.47M/18 on Nov 24 — fresh tokens up ~35%, 2 more runs; aws-cost-agent and software-analyzer-agent both returned after sitting out part of yesterday)

| Agent | Runs | Fresh | Output | Cache reads | Models |
|---|---|---|---|---|---|
| cto-agent | 8 | 686.2k | 59.8k | 7.72M | sonnet-5 |
| cpo-agent | 5 | 381.1k | 49.0k | 4.10M | opus-5-5, sonnet-5 |
| devx-agent | 2 | 339.1k | 56.2k | 10.91M | opus-5-5 |
| aws-cost-agent | 1 | 211.0k | 54.2k | 8.47M | sonnet-5 |
| software-analyzer-agent | 1 | 194.3k | 25.8k | 3.54M | opus-5-5 |
| chief-of-staff-agent | 1 | 98.3k | 11.4k | 598.7k | sonnet-5 |
| coo-agent | 2 | 76.5k | 8.1k | 237.5k | sonnet-5 |

Heaviest runs: aws-cost-agent at 11:30 UTC (211.0k fresh, 82 calls) · devx-agent at 04:00 UTC (208.3k fresh, 63 calls) · software-analyzer-agent at 05:30 UTC (194.3k fresh, 32 calls)

Notes: cto-agent remains the heaviest agent overall despite a quiet merge day — its 8 fixed-cadence reviews add up even when most find nothing on the bench. aws-cost-agent's single run this window was its heaviest in recent memory (82 calls tracing CloudWatch log-volume sources). No run reported zero usage.
