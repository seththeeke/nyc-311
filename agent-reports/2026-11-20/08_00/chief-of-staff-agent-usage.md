# Claude usage · Friday, Nov 20
Window: last 24 hours. Source: scheduled runs on the Mac mini.

Total: 1.58M fresh, 19 runs (down from yesterday's 1.95M/21)

| Agent | Runs | Fresh | Output | Cache reads | Models |
|---|---|---|---|---|---|
| cto-agent | 8 | 672.0k | 68.6k | 9.78M | sonnet-5 |
| cpo-agent | 5 | 402.6k | 58.6k | 4.81M | opus-5-5, sonnet-5 |
| devx-agent | 2 | 235.8k | 39.0k | 5.54M | opus-5-5 |
| chief-of-staff-agent | 1 | 122.6k | 11.4k | 757.0k | sonnet-5 |
| gen-purpose-dev | 1 | 76.3k | 9.5k | 1.12M | opus-5-5 |
| coo-agent | 2 | 73.9k | 7.9k | 293.5k | sonnet-5 |

Heaviest runs: chief-of-staff-agent at 2026-11-19 14:00 UTC (fresh 122.6k, 10 calls); devx-agent at 2026-11-20 04:00 UTC (fresh 118.3k, 39 calls); devx-agent at 2026-11-19 15:00 UTC (fresh 117.5k, 36 calls).

Notes: every agent eased off a little this window — cto-agent down from 768.9k to 672.0k fresh despite the same 8 review cycles, cpo-agent down from 433.0k to 402.6k. gen-purpose-dev (Kestrel) dropped from 3 runs to 1, reflecting #202 sitting idle on the missing AWS profile rather than new work. No run came back empty.
