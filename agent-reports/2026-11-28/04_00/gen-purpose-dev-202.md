# gen-purpose-dev: #202 backend: read feature flags in services

**Card:** Verified in Test Environment → **Requires CEO Intervention** (V4 latency abort).

## What I did
- **Prod deploy:** `DeployProd` succeeded on `7db201d` (2026-11-27 17:36 PT), which contains Leg 1 (`fcf13a3`).
- **First caller found:** it isn't #194 or #170. `dispatchPolicyService.ts` (`0a331a4`, doc 20) reads `DISPATCH_POLICY` in the scheduler Lambda, with `grantFlagRead` and the metric filters wired in. That starts the ticket's 7-day window. In Prod, `DISPATCH_POLICY` is at `C` (v1, no allocations). It isn't my flag, so I didn't change it.
- **V3 (success rate):** Logs Insights on `FeatureFlagRead` shows 8 of 8 reads in Prod and 8 of 8 in Test returned `TREATMENT`/`DEFAULT`/`C`. No fallbacks.
- **V4 (added latency):** `durationMs` in Prod is p50 461 ms and p99 479 ms (Test: 460 and 500), against p99 < 20 ms. In the scheduler's `REPORT` lines, all 9 of 9 invocations were cold starts (init averages 315 ms). The read builds a new client and connection on every call, and `durationMs` includes building it.
- **Abort rule (§5):** the caller's flag stays at `C`. It already is, so no flag changed. I logged the result in the spec, posted the intervention comment and moved the card to Requires CEO Intervention.

## Options for the CEO
1. Revise V4 for cold-start callers and keep the code. **I'd pick this.**
2. A fix PR that times only the `GetItem` and the evaluation.
3. An exemption from CLAUDE.md §5.2 that allows client reuse for flag reads.

## Queries
- Logs Insights, Prod and Test scheduler log groups: `filter message = "FeatureFlagRead" | stats count(*), pct(durationMs,50), pct(durationMs,99), max(durationMs) by @log, outcome, reason, treatment`
- Logs Insights, Prod scheduler log group: `filter @type = "REPORT" | fields ispresent(@initDuration) as cold | stats count(*), pct(@duration,50), pct(@duration,99), avg(@initDuration) by cold`
- No `run_query` calls.

## Next
The next run acts on the CEO's answer. Until then, `DISPATCH_POLICY` shouldn't be dialed up past `C`.

Spec commit `280b9a4`. Chat post `01M8GSPFH0Q5Q34FRNR18RX7DM`.
