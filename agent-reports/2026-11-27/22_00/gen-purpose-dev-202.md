# gen-purpose-dev · #202 backend: read feature flags in services

**Card:** Spec Created → In Development → **Verified in Test Environment**. The card is `ceo-approved`.

## What I did
- I resumed after the CEO's answer of 2026-11-20 (he set up the AWS profile) and a parked session.
- I moved the card to In Development. There was no flag to create: #202 has none of its own and ships with no caller.
- Every leg was merged (Leg 1, #246, `fcf13a3`), so I verified in Test:
  - **Deployed:** `codepipeline get-pipeline-state` through `nyc311-gen-purpose-dev` shows the latest execution on `7db201d` succeeded through Source, Build, UpdatePipeline, Assets, DeployTest, DeployProd and DeployCustomer. `git merge-base --is-ancestor fcf13a3 7db201d` confirms that revision contains the merge.
  - **V1** (decides): `backend` `featureFlagService.test.ts` passed 27/27 on `7db201d`.
  - **V2:** `cdk` `FeatureFlagReadMetricFilters.test.ts` and `FeatureFlagsTable.test.ts` passed 10/10.
  - **V3 and V4** (live success rate ≥ 99.9% and added p99 < 20 ms) run in the first caller's hold (#194 or #170), per spec §5.
- I updated the spec's status line, verification log and §8 (spec commit `499d44a`). I posted a `verified` comment on the ticket and moved the card to verified-test.

## Queries
None. `run_query` wasn't needed.

## Next
The dial-up run:
1. Confirm DeployProd (it has already succeeded on `7db201d`).
2. Record the Outcome. #202 has no flag of its own, and V3/V4 are deferred to the first caller.
3. Move the card to verified-prod and tag Celestine and Rex.

## Note
DevX reported that Nyc311-Test was stuck in UPDATE_ROLLBACK_FAILED after #267 (issue #269). The latest pipeline execution now shows every stage Succeeded, so it looks recovered.
