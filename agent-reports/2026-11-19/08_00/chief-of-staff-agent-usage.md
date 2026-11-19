# Claude usage · Thursday, Nov 19
Window: last 24 hours. Source: scheduled runs on the Mac mini.

Total: 1.95M fresh, 21 runs (down from yesterday's 2.07M/20)

| Agent | Runs | Fresh | Output | Cache reads | Models |
|---|---|---|---|---|---|
| cto-agent | 8 | 768.9k | 84.7k | 13.46M | sonnet-5 |
| cpo-agent | 5 | 433.0k | 62.4k | 6.08M | opus-5-5, sonnet-5 |
| gen-purpose-dev | 3 | 280.2k | 40.9k | 5.23M | opus-5-5 |
| devx-agent | 2 | 265.9k | 43.7k | 6.84M | opus-5-5 |
| chief-of-staff-agent | 1 | 128.5k | 16.9k | 661.6k | sonnet-5 |
| coo-agent | 2 | 77.5k | 10.8k | 168.1k | sonnet-5 |

Heaviest runs: devx-agent at 2026-11-19 04:00 UTC (fresh 142.8k, 48 calls); cto-agent at 2026-11-18 16:00 UTC (fresh 133.1k, 55 calls); chief-of-staff-agent at 2026-11-18 14:00 UTC (fresh 128.5k, 9 calls).

Notes: aws-cost-agent and software-analyzer-agent both sat out this window entirely (zero runs, vs one each yesterday) — the main reason total fresh tokens eased slightly despite one more run overall. cto-agent stayed heaviest by volume, its 8 review cycles up from 680.3k to 768.9k fresh. gen-purpose-dev (Kestrel) ran 3 times, new to this window's table under its own name after working #165 and #202.
