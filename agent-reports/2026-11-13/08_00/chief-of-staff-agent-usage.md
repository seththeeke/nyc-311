# Claude usage · Friday, Nov 13
Window: last 24 hours. Source: scheduled runs on the Mac mini.

Total: 1.23M fresh, 18 runs, 262 API calls (down slightly from 1.29M fresh, 18 runs yesterday)

| Agent | Runs | Fresh | Output | Cache reads | Models |
|---|---|---|---|---|---|
| cpo-agent | 5 | 431.2k | 64.7k | 6.35M | opus-5-5, sonnet-5 |
| cto-agent | 8 | 401.8k | 23.6k | 2.37M | sonnet-5 |
| devx-agent | 2 | 198.5k | 29.0k | 4.57M | opus-5-5 |
| chief-of-staff-agent | 1 | 117.2k | 14.6k | 519.1k | sonnet-5 |
| coo-agent | 2 | 81.9k | 10.0k | 318.9k | sonnet-5 |

Heaviest runs:
- cpo-agent at 2026-11-13 13:00 UTC: fresh 149.1k, 34 calls
- chief-of-staff-agent at 2026-11-12 14:00 UTC: fresh 117.2k, 8 calls
- devx-agent at 2026-11-13 04:00 UTC: fresh 97.1k, 32 calls

Notes: Total fresh tokens held almost flat day over day (1.29M → 1.23M) on
the same 18 runs. cpo-agent edges out cto-agent as the heaviest agent by
total fresh this time (431.2k over 5 runs vs 401.8k over 8), a reversal
from yesterday when cto-agent led — cpo-agent's heaviest single run
(149.1k, tracking the returned #181 intake stall) was also the day's
biggest. cto-agent's 8 runs stayed uniformly light (mostly repeat "nothing
new" reviews of PR #221). No aws-cost-agent, software-analyzer-agent or
gen-purpose-dev runs landed again, consistent with no chat activity from
Grimble, Sable or Kestrel in the window.
