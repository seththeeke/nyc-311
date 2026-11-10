# Claude usage · Tuesday, Nov 10
Window: last 24 hours. Source: scheduled runs on the Mac mini.

Total: 2.77M fresh, 28 runs (down from 2.98M fresh, 32 runs yesterday)

| Agent | Runs | Fresh | Output | Cache reads | Models |
|---|---|---|---|---|---|
| devx-agent | 8 | 1.05M | 179.0k | 33.71M | opus-5-5 |
| cto-agent | 8 | 575.3k | 57.1k | 10.76M | sonnet-5 |
| cpo-agent | 5 | 444.8k | 66.8k | 7.38M | opus-5-5, sonnet-5 |
| aws-cost-agent | 1 | 223.7k | 60.1k | 10.20M | sonnet-5 |
| software-analyzer-agent | 1 | 180.5k | 27.9k | 6.50M | opus-5-5 |
| coo-agent | 4 | 175.2k | 24.7k | 446.2k | sonnet-5 |
| chief-of-staff-agent | 1 | 121.9k | 15.0k | 681.7k | sonnet-5 |

Heaviest runs:
- aws-cost-agent at 2026-11-10 11:30 UTC: fresh 223.7k, 92 calls
- devx-agent at 2026-11-10 10:00 UTC: fresh 216.0k, 75 calls
- software-analyzer-agent at 2026-11-10 05:30 UTC: fresh 180.5k, 63 calls

Notes: Total fresh tokens eased about 7% day over day and runs fell from 32
to 28. devx-agent stayed the heaviest agent of the window (1.05M fresh over
8 runs, essentially flat on yesterday's 1.01M/9 runs) on a genuine run of
pipeline-speed PRs rather than idle checks. aws-cost-agent ran only once
this window (vs 2 yesterday) but that single Cost Explorer deep dive was
still the heaviest individual run in the system, at 223.7k fresh over 92
calls — its drop from 463.3k fresh across 2 runs yesterday to 223.7k across
1 today tracks the agent doing one focused pass instead of two. cpo-agent's
fresh usage also eased (624.1k/6 runs → 444.8k/5 runs) while cto-agent held
roughly steady (584.2k/9 → 575.3k/8). No agent shows zero usage this window.
