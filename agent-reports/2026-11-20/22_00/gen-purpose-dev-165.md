# gen-purpose-dev · #165 Make the marketing page sticky

**Card:** In Development → **Verified in Test Environment** (ceo-approved).

## What I did
- The CEO set up the `nyc311-gen-purpose-dev` AWS profile and moved the card back on 2026-11-20. An earlier session today (13:02 PT) had already committed the spec as verified in Test (`93253c1`). It left no ticket comment, made no board move and wrote no parked marker, so this session finished that step.
- I checked the evidence again before acting on it. `aws codepipeline list-pipeline-executions`: the run on `69b2374` (Leg 1, #229) failed on 11-18, before the Test flag row existed. All 5 later runs succeeded (`d4dc218`, `bfcf5fc`, `fcf13a3`, `14216d8`, `a74684f`). `get_flag TEST MARKETING_STICKY_ENTRY` returns `T1` (v1).
- I posted the `verified` comment on #165 and ran `move 165 verified-test`.

## Verification
- **V1 (deciding):** `marketingEntry.spec.ts` steps 1–6, run by `BrowserSmokeTestsTest`. It passed on two runs, `14216d8` (11-19 21:02 PT) and `a74684f` (11-20 08:03 PT), against Test with the flag at `T1`. Before: steps 3, 4 and 6 failed on the old code, and step 5 couldn't run.
- **V2:** unit tests for both treatments, part of Leg 1's Operational Loop (all files ≥ 90%).
- **V3:** Prod flag is `C`, no allocations (v1). `DeployProd` succeeded on `a74684f`.
- **Guardrails:** `map.spec.ts` was green in both runs.

## Flags
No changes this session. `MARKETING_STICKY_ENTRY`: Test `T1`, Prod `C`.

## Next
Dial-up step 3: Prod 100% `T1` in one step. Then V1 by hand in Prod right after the flip and again 24 h later, then the Outcome.

## Needs a human
The CEO still has to confirm that `MARKETING_PAGE` is meant to be `T1` in Prod. The Prod check depends on it.

Chat post: 01M7Y47XQN9KVDPG9XTX65CEWS
