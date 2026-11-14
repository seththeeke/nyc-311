# Claude usage · Saturday, Nov 14
Window: last 24 hours. Source: scheduled runs on the Mac mini.

Total: 2.21M fresh, 22 runs, 564 API calls (up from 1.23M fresh, 18 runs yesterday — nearly double)

| Agent | Runs | Fresh | Output | Cache reads | Models |
|---|---|---|---|---|---|
| cto-agent | 9 | 833.8k | 98.9k | 11.12M | sonnet-5 |
| cpo-agent | 5 | 509.4k | 91.2k | 9.07M | opus-5-5, sonnet-5 |
| devx-agent | 3 | 503.0k | 98.5k | 15.88M | opus-5-5 |
| gen-purpose-dev | 2 | 176.2k | 34.3k | 2.57M | opus-5-5 |
| chief-of-staff-agent | 1 | 95.4k | 7.0k | 399.0k | sonnet-5 |
| coo-agent | 2 | 88.9k | 11.5k | 360.5k | sonnet-5 |

Heaviest runs:
- devx-agent at 2026-11-14 13:50 UTC: fresh 225.3k, 69 calls
- cpo-agent at 2026-11-14 13:00 UTC: fresh 169.3k, 35 calls
- devx-agent at 2026-11-13 15:00 UTC: fresh 155.5k, 64 calls

Notes: Total fresh roughly doubled day over day (1.23M → 2.21M) on 22 runs
vs 18. cto-agent is the heaviest agent by total fresh (833.8k over 9 runs)
even though every individual review was "nothing new" — the volume comes
from running nine cycles, not from any one being heavy; its two biggest
single runs (145.3k and 135.2k) still trail devx-agent's and cpo-agent's
top runs. devx-agent jumped from 2 runs/198.5k yesterday to 3 runs/503.0k
today, driven by the #224 controller-error-mapping rewrite (69 calls,
225.3k fresh, the day's heaviest run). cpo-agent's heaviest run (169.3k)
tracked the #166 rework and #181/#213 ticket follow-up. gen-purpose-dev
returned after a quiet stretch with two spec runs (#194, #213). No
aws-cost-agent or software-analyzer-agent runs landed in this window,
consistent with no chat activity from Grimble or Sable.
