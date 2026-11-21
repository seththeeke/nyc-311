# gen-purpose-dev: #165 Sticky marketing page

**Card:** Verified in Test Environment (`ceo-approved`). This was a dial-up run.

## What I did
- **Deploy check:** `get-pipeline-state` shows the latest run, on `f4caae7`, succeeded end to end: `DeployTest` with `BrowserSmokeTestsTest` and `IntegrationTestsTest`, then `DeployProd` with `IntegrationTestsProd` (11-20 21:14 PT). Leg 1's merge `69b2374` is an ancestor of `f4caae7`.
- **Where the flag stood:** `MARKETING_STICKY_ENTRY` in Prod was default `C` with no allocations (v1), so the dial-up hadn't started. `MARKETING_PAGE` in Prod is `T1` (v6).
- **Guardrails, recorded before the flip:** all green on that run.
- **Dial-up step 3 of the plan:** Prod is now allocated 100% `T1` (v2, 2026-11-21 10:00 UTC). It's a single step, per the plan.
- **V1 right after the flip:** `marketingEntry.spec.ts` passed 3/3 (steps 1–6) against Test. I couldn't run it against Prod: `SMOKE_BASE_URL=https://boroughsim.com` needs approval in a headless run, so it was denied. No guardrail has been seen past its threshold, so this isn't an abort.
- **Spec:** I logged the guardrails, the flip and the V1 attempt. I also added the allowlist request to "Needs the CEO". Commit `9d212c2`.
- **Ticket:** `dialup` comment posted. Chat: a top-level post plus a thread reply tagging @Seth.

## Where it stands
The card stays in Verified in Test. The flag is at 100% `T1` in Prod, and the 24 h hold runs until 2026-11-22 10:00 UTC.

## Next
- **The 24 h check:** repeat V1 in Prod (steps 1–4 and 6 must pass; 5 also runs) and V3. Then write the Outcome and move the card to verified-prod, tagging Celestine and Rex.
- **This needs the CEO first:** allow `env SMOKE_BASE_URL=https://boroughsim.com npm run test:smoke -- marketingEntry` in `.claude/agent-settings/gen-purpose-dev.json`, or run it and post the result. Without one of those, the next run sends the card to CEO intervention.
- The CEO should still confirm `MARKETING_PAGE` is meant to be `T1` in Prod.
- The issue shows as CLOSED on GitHub, though the card is still live. That's the CEO's call.

## Notes
- **Memory not updated:** editing `.claude/agent-memory/gen-purpose-dev/MEMORY.md` was denied as a sensitive file. Its #165 row is stale (it says intervention). It should say: Prod at 100% `T1` (v2, 11-21), awaiting the 24 h check. Lesson to add: a Prod smoke run needs an allowlist entry, because any `env`/`SMOKE_BASE_URL` prefix needs approval.
- Queries used: none (`run_query` not needed).
