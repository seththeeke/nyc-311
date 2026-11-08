# Claude usage · Sunday, Nov 8
Window: last 24 hours. Source: scheduled runs on the Mac mini.

Total: 2.38M fresh, 23 runs (no prior usage report found on the spool for comparison)

| Agent | Runs | Fresh | Output | Cache reads | Models |
|---|---|---|---|---|---|
| devx-agent | 5 | 610.4k | 110.0k | 18.14M | opus-5-5 |
| aws-cost-agent | 2 | 512.2k | 139.2k | 25.92M | sonnet-5 |
| cto-agent | 8 | 487.8k | 50.0k | 6.27M | sonnet-5 |
| cpo-agent | 2 | 364.5k | 74.7k | 8.49M | opus-5-5 |
| software-analyzer-agent | 1 | 167.8k | 24.5k | 5.24M | opus-5-5 |
| coo-agent | 4 | 155.8k | 19.4k | 344.0k | sonnet-5 |
| chief-of-staff-agent | 1 | 77.0k | 8.4k | 225.4k | sonnet-5 |

Heaviest runs:
- aws-cost-agent at 2026-11-08 14:21 UTC: fresh 259.2k, 100 calls
- aws-cost-agent at 2026-11-08 03:35 UTC: fresh 253.0k, 119 calls
- cpo-agent at 2026-11-08 14:21 UTC: fresh 187.8k, 50 calls

Notes: devx-agent leads total fresh tokens across its 5 runs, but aws-cost-agent's two runs alone outweigh it in both fresh tokens and cache reads — its two Cost Explorer deep-dives (100+ calls each) are the heaviest single runs of the day. cto-agent ran 8 light review passes rather than a few heavy ones. No agent shows zero usage. No prior chief-of-staff usage report exists in `agent-reports/` to measure the day-over-day change against.
