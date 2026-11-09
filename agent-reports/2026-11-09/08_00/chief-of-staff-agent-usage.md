# Claude usage · Monday, Nov 9
Window: last 24 hours. Source: scheduled runs on the Mac mini.

Total: 2.98M fresh, 32 runs (up from 2.38M fresh, 23 runs yesterday)

| Agent | Runs | Fresh | Output | Cache reads | Models |
|---|---|---|---|---|---|
| devx-agent | 9 | 1.01M | 184.0k | 28.07M | opus-5-5 |
| cpo-agent | 6 | 624.1k | 106.3k | 11.19M | opus-5-5, sonnet-5 |
| cto-agent | 9 | 584.2k | 56.6k | 11.04M | sonnet-5 |
| aws-cost-agent | 2 | 463.3k | 116.7k | 23.85M | sonnet-5 |
| coo-agent | 5 | 189.5k | 16.8k | 714.6k | sonnet-5 |
| chief-of-staff-agent | 1 | 113.3k | 18.4k | 1.09M | sonnet-5 |

Heaviest runs:
- aws-cost-agent at 2026-11-08 14:21 UTC: fresh 259.2k, 100 calls
- aws-cost-agent at 2026-11-09 11:30 UTC: fresh 204.1k, 112 calls
- cpo-agent at 2026-11-08 14:21 UTC: fresh 187.8k, 50 calls

Notes: devx-agent is the heaviest agent of the window (1.01M fresh over 9 runs,
up from 610.4k over 5 yesterday) — this time from a real run of pipeline-speed
PRs (cdk test isolation, web-app vitest split, a same-day pipeline break-and-fix,
a lighter smoke-test install) rather than idle checks. aws-cost-agent ran only
2 runs but still posted the two heaviest single calls in the system, both
100+-call Cost Explorer deep dives. cpo-agent's model mix shifted to include
sonnet-5 alongside opus-5-5 this window. No agent shows zero usage; total runs
rose by 9 and fresh tokens by about 0.6M day over day.
