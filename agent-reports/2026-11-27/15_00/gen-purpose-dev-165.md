# gen-purpose-dev: #165 Make the marketing page sticky

**Card:** Verified in Test Environment → **Requires CEO Intervention**.

## What I did
The 11-21 session parked, and the CEO resumed the card today. I picked up the dial-up where it stopped. `MARKETING_STICKY_ENTRY` has been at 100% `T1` in Prod since 2026-11-21 10:00 UTC, so the 24 h window is over. Next in the plan: repeat every check and write the Outcome.

## Checks
- **V3 (flag read):** Prod is default `C` with allocation 100% `T1` (v2). `MARKETING_PAGE` Prod is `T1` (v6).
- **Pipeline / guardrails:** the latest run, `ac4ee60` (11-25), deployed Prod ✅ and passed `IntegrationTestsProd` ✅. On the same run, `Nyc311-Test.Deploy` failed, so `BrowserSmokeTestsTest` didn't run. #165 didn't cause that: every run after its merge, through `f4caae7`, was green.
- **V1 against Test:** `marketingEntry.spec.ts` gave 2 passed and 1 flaky. Step 6 (About → Back to the intro) hung for 90 s on a click on a visible, stable button, then passed on retry in 6.8 s.
- **V1 against Prod (the deciding check):** not run. `env SMOKE_BASE_URL=https://boroughsim.com npm run test:smoke -- marketingEntry` needs approval in a headless run. The 11-21 request for an allowlist entry or a manual run got no answer.

No guardrail is past its threshold, so this isn't an abort. The flag stays at 100% `T1`.

## Why intervention
The Outcome needs V1 in Prod, and only a human can grant the command or run it. That's a missing permission blocking verification, not waiting.

## Changes
- Spec commit `453a098`: status line, four verification-log rows, Needs the CEO updated.
- Ticket comment (intervention): https://github.com/seththeeke/nyc-311/issues/165#issuecomment-7228099276
- Card moved to `ceo-intervention`.
- No flag change. No PR.

## What the CEO needs to do
1. Allowlist the Prod smoke command in `.claude/agent-settings/gen-purpose-dev.json` and move the card back to Verified in Test (my pick).
2. Or run it yourself and post the result on #165.

Also look at the `Nyc311-Test.Deploy` failure on `ac4ee60`.

## Next
Repeat V1 in Prod, write the Outcome, move to verified-prod, tag Celestine and Rex, and file the flag-cleanup issue.

## Memory (not saved)
I couldn't update memory this run (the edit was denied). The updates for the next run:
- The #165 row: CEO intervention 11-27, spec `453a098`, Prod alloc 100% `T1` (v2).
- A lesson: the AWS profile works. The Test smoke works when run as `cd web-app && npm run test:smoke`. A `SMOKE_BASE_URL=` prefix needs approval. Get Prod check commands allowed before the flip.
