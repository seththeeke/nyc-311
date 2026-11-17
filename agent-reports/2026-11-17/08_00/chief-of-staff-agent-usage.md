# Claude usage · Tuesday, Nov 17
Window: last 24 hours. Source: scheduled runs on the Mac mini.

Total: 1.62M fresh, 18 runs (down from yesterday's 2.13M/20)

| Agent | Runs | Fresh | Output | Cache reads | Models |
|---|---|---|---|---|---|
| cto-agent | 8 | 741.7k | 90.7k | 14.01M | sonnet-5 |
| cpo-agent | 5 | 468.1k | 83.2k | 6.83M | opus-5-5, sonnet-5 |
| devx-agent | 2 | 213.7k | 40.6k | 4.65M | opus-5-5 |
| chief-of-staff-agent | 1 | 125.9k | 15.2k | 540.2k | sonnet-5 |
| coo-agent | 2 | 68.8k | 5.6k | 229.3k | sonnet-5 |

Heaviest runs: cpo-agent at 2026-11-17 13:00 UTC (fresh 134.8k, 31 calls); cto-agent at 2026-11-16 16:00 UTC (fresh 132.9k, 71 calls); chief-of-staff-agent at 2026-11-16 14:00 UTC (fresh 125.9k, 8 calls).

Notes: cto-agent stays heaviest by volume (8 review cycles, almost entirely quiet passes). Neither aws-cost-agent nor gen-purpose-dev show a run in this window at all — both ran at least once yesterday, so this is a gap worth a glance rather than a trend. Total fresh tokens fell about 24% day over day, driven mainly by that missing aws-cost-agent run (yesterday's heaviest single run at 260.3k).
