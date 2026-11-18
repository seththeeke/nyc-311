# gen-purpose-dev: #202 backend: read feature flags in services

**Card:** Spec Created → **In Development** (ceo-approved). The move was accepted.

## What I did
- Started development. The spec has no flag of its own (the read ships with no caller), so I created no flag rows.
- Built **Leg 1, the only leg**, on `gen-purpose-dev/202-leg1-fail-safe-flag-read`. It's PR **#246** (commit `514a75a`):
  - `backend/service/featureFlag/featureFlagService.ts`: `getTreatment(flagKey, ctx, { fallback, treatments? }, deps)` never rejects. Each failure returns `fallback` with its own reason:
    - a missing flag: `FLAG_MISSING`;
    - a DynamoDB error, a malformed row or an unset `FEATURE_FLAGS_TABLE_NAME`: `READ_FAILED`;
    - a treatment outside the caller's list: `UNKNOWN_TREATMENT`.

    Each read logs one `FeatureFlagRead` line with outcome, reason, treatment, flagVersion, durationMs and functionName. It replaces `TreatmentFallbackUsed`.
  - `cdk/data/FeatureFlagsTable.ts`: `grantFlagRead(grantee)` grants `dynamodb:GetItem` only.
  - `cdk/lambda/FeatureFlagReadMetricFilters.ts`: three metric filters (Succeeded, FellBack, DurationMs) in `Nyc311/FeatureFlags`, with dimensions FunctionName and FlagKey.
  - Updated the `getTreatment` line in `docs/11-street-condition-implementation.md` §4.3.
- Updated the spec: status set to In Development, the leg row set to #246 In review, the Operational Loop and V1/V2 results logged, and the build choices added to the appendix. Spec commit `9294dd3`.
- Posted a ticket comment (`build` marker) and a chat post with a thread reply.

## Checks
- **V1 (the deciding check):** 10 `getTreatment` cases. Every path resolves without throwing and logs exactly one `FeatureFlagRead` line. Pass.
- **V2:** the template tests pass:
  - the grant is a single `GetItem` statement on the table's ARN;
  - the 3 filters have the patterns and dimensions the spec gives.
- **Operational Loop:**

  | Package | Build | Lint | Tests | Coverage |
  |---|---|---|---|---|
  | backend | pass | pass | 1661 pass | 99.95% statements; the service file is fully covered |
  | cdk | pass | pass | 488 pass | 100% |

- No queries were used, and no flags were changed.

## Next
Rex reviews #246 and Seth merges it. After that, a later run confirms DeployTest and moves the card to Verified in Test. The Test checks are V1 and V2, which already pass. V3 and V4 run during the first caller's hold (#194 or #170).

## Notes for a human
- I couldn't update my memory file: the edit to `.claude/agent-memory/gen-purpose-dev/MEMORY.md` was refused as a sensitive file. Lessons to keep:
  - #202 is In Development with PR #246.
  - The API that #194 and #170 callers use:
    - `getTreatment(key, ctx, {fallback:"C", treatments:["C","T1"]})`
    - `grantFlagRead(fn)`
    - `new FeatureFlagReadMetricFilters(this, id, {logGroup})`
  - `cd x && git`, `git -C` and `python3 -` all need approval. Plain `git` from inside a package directory works.
- The AWS profile `nyc311-gen-purpose-dev` is still needed to confirm deploys and to run V3/V4.
