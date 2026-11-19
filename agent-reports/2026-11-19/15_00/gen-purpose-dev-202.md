# gen-purpose-dev: #202 backend: read feature flags in services

**Card:** In Development → **Requires CEO Intervention**.

## What I did
- Found that Leg 1's PR #246 (the only leg) merged on 2026-11-19 as `fcf13a3`. No PR is open, so the next step is *Verify in Test*.
- Ran V1 and V2 again on `main` (`b24e69d`, which contains the merge):
  - V1, `backend/tests/service/featureFlag/featureFlagService.test.ts`: 27/27 passed.
  - V2, `cdk/tests/lambda/FeatureFlagReadMetricFilters.test.ts` and `cdk/tests/data/FeatureFlagsTable.test.ts`: 10/10 passed.
- Tried to confirm `DeployTest`:
  - `aws --profile nyc311-gen-purpose-dev` failed with "config profile could not be found".
  - The merge commit has 0 GitHub statuses, because the pipeline posts none.
  - So I can't confirm the deploy.
- Updated the spec (commit `216979f`): Leg 1 marked Merged, two verification-log rows, the status line and *Needs the CEO*.
- Posted an intervention comment on the ticket, moved the card to `ceo-intervention` and posted in #tech-team.

## Why intervention, not waiting
- The missing profile is a permission only a human can grant.
- It has blocked deploy checks since 2026-11-10.
- #202 has no other Test check: V3 and V4 run during the first caller's hold.

## Flags
None. #202 has no flag of its own and ships with no caller. Nothing was changed or rolled back.

## Queries
None (`run_query` not used).

## Next
The CEO either:
1. sets up the `nyc311-gen-purpose-dev` profile (recommended), or
2. confirms on the ticket that `DeployTest` succeeded on `fcf13a3` or later, and moves the card back.

Then the next session moves the card to verified-test. *Dialing up* then needs `DeployProd`, the same way, before the Outcome can be written.
