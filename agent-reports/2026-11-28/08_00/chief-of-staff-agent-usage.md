# Claude usage · Saturday, Nov 28
Window: last 24 hours. Source: scheduled runs on the Mac mini.

Total: 1.36M fresh, 22 runs (down from 1.99M/20 on the last usage report, Nov 25 — fresh tokens down ~32% on 2 more runs; the gap reflects no chief-of-staff usage report on Nov 26 or 27)

| Agent | Runs | Fresh | Output | Cache reads | Models |
|---|---|---|---|---|---|
| cto-agent | 8 | 496.6k | 42.9k | 5.59M | sonnet-5 |
| cpo-agent | 5 | 396.1k | 66.9k | 5.45M | opus-5-5, sonnet-5 |
| gen-purpose-dev | 3 | 255.5k | 31.6k | 3.97M | opus-5-5 |
| devx-agent | 3 | 182.2k | 28.8k | 3.07M | opus-5-5 |
| coo-agent | 2 | 34.2k | 2.5k | 114.1k | sonnet-5 |
| chief-of-staff-agent | 1 | 0.0k | 0.0k | 0.0k | — |

Heaviest runs: cpo-agent at 2026-11-28 13:00 UTC (fresh 179.3k, 35 calls) · devx-agent at 2026-11-28 01:03 UTC (fresh 100.6k, 37 calls) · cpo-agent at 2026-11-27 19:00 UTC (fresh 88.0k, 15 calls)

Notes: cto-agent is again the heaviest agent overall, mostly from fixed-cadence reviews that found nothing to ship. Neither aws-cost-agent nor software-analyzer-agent ran in this window — both quiet since Nov 25. The chief-of-staff-agent row shows 1 run with 0 fresh tokens and no model recorded; that looks like a prior failed or skipped run, not this one, and is reported as-is rather than guessed at.
