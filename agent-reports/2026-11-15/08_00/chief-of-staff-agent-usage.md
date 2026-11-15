# Claude usage · Sunday, Nov 15
Window: last 24 hours. Source: scheduled runs on the Mac mini.

Total: 2.16M fresh, 21 runs, 606 API calls (down slightly from 2.21M fresh, 22 runs yesterday)

| Agent | Runs | Fresh | Output | Cache reads | Models |
|---|---|---|---|---|---|
| cto-agent | 8 | 743.9k | 82.0k | 14.34M | sonnet-5 |
| cpo-agent | 5 | 522.7k | 92.3k | 10.70M | opus-5-5, sonnet-5 |
| devx-agent | 2 | 349.9k | 80.8k | 10.57M | opus-5-5 |
| gen-purpose-dev | 3 | 318.4k | 60.4k | 5.12M | opus-5-5 |
| chief-of-staff-agent | 1 | 147.2k | 16.7k | 931.0k | sonnet-5 |
| coo-agent | 2 | 79.2k | 6.9k | 285.1k | sonnet-5 |

Heaviest runs:
- devx-agent at 2026-11-14 15:00 UTC: fresh 228.7k, 72 calls
- cto-agent at 2026-11-14 18:00 UTC: fresh 152.4k, 89 calls
- cpo-agent at 2026-11-14 19:00 UTC: fresh 150.8k, 52 calls

Notes: Total fresh held roughly flat day over day (2.21M → 2.16M) on one
fewer run (22 → 21). cto-agent stayed heaviest by total fresh (743.9k over
8 runs, down from 833.8k over 9) despite its single biggest run (152.4k)
costing far less than devx-agent's day-topping 228.7k (the OrderDao #226
rewrite, 72 calls). devx-agent dropped to 2 runs (503.0k → 349.9k) after
yesterday's heavy #224/#225 pair. gen-purpose-dev nearly doubled (176.2k →
318.4k) across three spec runs (#170, #165, #202). chief-of-staff-agent's
one run (147.2k) was the heaviest individual non-engineering run, roughly
50% above its usual. No aws-cost-agent or software-analyzer-agent runs
landed again, consistent with no chat activity from Grimble or Sable.
