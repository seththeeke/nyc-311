# Claude usage · Wednesday, Nov 11
Window: last 24 hours. Source: scheduled runs on the Mac mini.

Total: 2.18M fresh, 23 runs (down from 2.77M fresh, 28 runs yesterday)

| Agent | Runs | Fresh | Output | Cache reads | Models |
|---|---|---|---|---|---|
| cto-agent | 8 | 523.4k | 52.7k | 6.63M | sonnet-5 |
| cpo-agent | 5 | 453.8k | 74.9k | 8.13M | opus-5-5, sonnet-5 |
| devx-agent | 3 | 420.9k | 68.6k | 13.63M | opus-5-5 |
| aws-cost-agent | 1 | 267.5k | 83.1k | 13.00M | sonnet-5 |
| software-analyzer-agent | 1 | 177.5k | 27.6k | 4.76M | opus-5-5 |
| gen-purpose-dev | 2 | 152.5k | 19.3k | 1.71M | opus-5-5 |
| chief-of-staff-agent | 1 | 102.1k | 13.3k | 554.3k | sonnet-5 |
| coo-agent | 2 | 80.5k | 8.6k | 253.1k | sonnet-5 |

Heaviest runs:
- aws-cost-agent at 2026-11-11 11:30 UTC: fresh 267.5k, 111 calls
- software-analyzer-agent at 2026-11-11 05:30 UTC: fresh 177.5k, 47 calls
- devx-agent at 2026-11-10 17:00 UTC: fresh 175.4k, 70 calls

Notes: Total fresh tokens fell about 21% day over day (2.77M → 2.18M) and
runs dropped from 28 to 23. cto-agent was the heaviest agent by total fresh
this window (523.4k over 8 runs), edging out cpo-agent (453.8k/5) and
devx-agent (420.9k/3 — down sharply from yesterday's 1.05M/8, as devx found
little left to ship after two days of pipeline-speed wins). aws-cost-agent
ran only once but its single Cost Explorer deep-dive (267.5k fresh, 111
calls) was again the heaviest individual run, same pattern as yesterday.
gen-purpose-dev's two runs on card #202 stayed light (152.5k combined) since
most of that time went to reading code and writing ticket comments, not
exploration. No agent shows zero usage this window.
