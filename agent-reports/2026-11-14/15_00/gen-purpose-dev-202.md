# Kid Kestrel · #202 backend: read feature flags in services

**Card:** #202. It moved from Assigned to **Spec Created** on 2026-11-14 and is held 12 hours before development.

## What I did
- **Resumed the thread.** It had been parked twice. Celestine answered both parks: on 11-10 she gave the dial-up, the baseline approach and the query of record. On 11-14 she ruled that the latency baseline can be recorded as "to be measured".
- **Re-checked the bar.** The verification block, with Flag and Dial-up lines, and both approval labels are present.
- **Re-read the code.**
  - `featureFlagService.getTreatment` still has 0 callers. The HTTP route uses `evaluateFeatureFlag`.
  - A DynamoDB error or a malformed row throws out of `getTreatment`.
  - Nothing rejects a treatment the caller doesn't know.
- **Checked the AWS profile.** `nyc311-gen-purpose-dev` is still missing.
- **Wrote and committed the spec:** `docs/kid-kestral/202-backend-read-feature-flags-in-services-so-backend-changes-can-ship-dark.md`, commit `b414bed`.
- **Commented** on the ticket, **moved** the card and **posted** to #tech-team with a thread reply.

## Verification plan and "before"
- **V1 (decides): unit tests.** Each failure path must return the caller's fallback (`C`) without throwing:
  - a missing flag;
  - a DynamoDB error;
  - a malformed row;
  - an unset table env var;
  - an unknown treatment.

  A valid flag must return `TREATMENT`. **Before:** two of those paths throw today.
- **V2: cdk template tests.** They check the `GetItem`-only grant and the three metric filters.
- **V3: live success rate during the first caller's hold.** It is read from the `FeatureFlagRead` metric filters (`Nyc311/FeatureFlags`), and the target is ≥ 99.9%. **Before:** none, since no backend reads exist.
- **V4 (guardrail): p99 under 20 ms.** **Before:** to be measured with the Logs Insights query on `Nyc311FeatureFlagsApi-Prod`, run before the first caller's `T1` step.

**Queries:**
- No warehouse queries.
- One `get_flag` call (`MARKETING_PAGE`), to confirm the read path is live in Prod.
- Code greps to confirm the 0 callers.

## Flag and legs
- **Flag:** none of its own. It ships dark with no caller, and the first caller's flag is its dial-up.
- **Leg 1, `backend/` + `cdk/`:**
  - `getTreatment` never throws and takes an optional `treatments` list.
  - It emits a `FeatureFlagRead` log line (outcome, reason, `durationMs`, `functionName`).
  - `FeatureFlagsTable.grantFlagRead()` grants `GetItem` only.
  - A `FeatureFlagReadMetricFilters` construct adds the filters.

## Next
- **The CEO** sets up the read-only AWS profile before the first caller's hold. V3 and V4 need it.
- **After the 12-hour hold**, the card is ready for development once K2 starts.
