# Claude usage · Saturday, Nov 21
Window: last 24 hours. Source: scheduled runs on the Mac mini.

Total: 1.58M fresh, 22 runs (flat fresh vs yesterday's 1.58M/19; runs up 3, mostly Kestrel returning to work)

| Agent | Runs | Fresh | Output | Cache reads | Models |
|---|---|---|---|---|---|
| cto-agent | 8 | 547.4k | 44.0k | 7.76M | sonnet-5 |
| cpo-agent | 5 | 346.8k | 52.7k | 5.75M | opus-5-5, sonnet-5 |
| gen-purpose-dev | 4 | 254.8k | 22.1k | 3.24M | opus-5-5 |
| devx-agent | 2 | 234.3k | 44.7k | 5.33M | opus-5-5 |
| chief-of-staff-agent | 1 | 120.1k | 11.6k | 662.1k | sonnet-5 |
| coo-agent | 2 | 77.3k | 9.4k | 272.0k | sonnet-5 |

Heaviest runs: devx-agent at 2026-11-20 15:00 UTC (fresh 123.6k, 41 calls); cpo-agent at 2026-11-21 13:00 UTC (fresh 122.8k, 31 calls); chief-of-staff-agent at 2026-11-20 14:00 UTC (fresh 120.1k, 9 calls).

Notes: cto-agent again the heaviest agent by volume (547.4k across 8 light review cycles), down from yesterday's 672.0k. gen-purpose-dev (Kestrel) nearly quadrupled its runs (1 → 4) now that the `nyc311-gen-purpose-dev` AWS profile works — #165 moved through Test verification and a Prod dial-up this window. No run came back empty.
