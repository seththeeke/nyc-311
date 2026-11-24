# Claude usage · Tuesday, Nov 24
Window: last 24 hours. Source: scheduled runs on the Mac mini.

Total: 1.47M fresh, 18 runs (down from 1.76M/19 on Nov 23 — fresh tokens down ~16%, one fewer run)

| Agent | Runs | Fresh | Output | Cache reads | Models |
|---|---|---|---|---|---|
| cto-agent | 8 | 643.1k | 64.5k | 8.50M | sonnet-5 |
| cpo-agent | 5 | 415.8k | 61.2k | 5.19M | opus-5-5, sonnet-5 |
| devx-agent | 2 | 221.7k | 40.6k | 7.63M | opus-5-5 |
| chief-of-staff-agent | 1 | 119.5k | 10.0k | 665.7k | sonnet-5 |
| coo-agent | 2 | 67.5k | 4.4k | 172.3k | sonnet-5 |

Heaviest runs: cpo-agent at 13:00 UTC (125.9k fresh, 27 calls) · chief-of-staff-agent at 14:00 UTC Nov 23 (119.5k fresh, 9 calls) · devx-agent at 15:00 UTC Nov 23 (118.3k fresh, 66 calls)

Notes: aws-cost-agent didn't run in this window at all — the prior window's single run (240.2k fresh) is simply absent today, which accounts for most of the day-over-day drop; the other agents held close to their recent norms. No agent ran unusually heavy this time.
