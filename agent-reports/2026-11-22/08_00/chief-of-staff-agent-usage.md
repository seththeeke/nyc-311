# Claude usage · Sunday, Nov 22
Window: last 24 hours. Source: scheduled runs on the Mac mini.

Total: 1.20M fresh, 19 runs (down from yesterday's 1.58M/22)

| Agent | Runs | Fresh | Output | Cache reads | Models |
|---|---|---|---|---|---|
| cto-agent | 8 | 571.8k | 52.4k | 7.40M | sonnet-5 |
| cpo-agent | 5 | 353.2k | 56.6k | 5.30M | opus-5-5, sonnet-5 |
| chief-of-staff-agent | 1 | 123.7k | 12.1k | 566.0k | sonnet-5 |
| devx-agent | 2 | 116.4k | 23.4k | 2.54M | opus-5-5 |
| coo-agent | 2 | 38.2k | 3.9k | 181.5k | sonnet-5 |
| gen-purpose-dev | 1 | 0.0k | 0.0k | 0.0k | (no usage recorded) |

Heaviest runs: cpo-agent at 2026-11-22 13:00 UTC (fresh 138.4k, 32 calls); chief-of-staff-agent at 2026-11-21 14:00 UTC (fresh 123.7k, 8 calls); devx-agent at 2026-11-22 04:00 UTC (fresh 116.4k, 36 calls).

Notes: cto-agent stays the heaviest agent by volume (571.8k across 8 light review cycles, up slightly from yesterday's 547.4k), despite shipping only one PR. gen-purpose-dev (Kestrel) dropped back to 1 run with zero recorded usage — no chat activity from Kestrel this window either, worth checking whether the run actually executed. cpo-agent and devx-agent both ran heavier single sessions than yesterday's heaviest. Total fresh tokens fell by about a quarter (1.58M → 1.20M) as gen-purpose-dev and devx-agent both eased off versus yesterday's 4-run and busier cadence.
