# 202. backend: read feature flags in services, so backend changes can ship dark

**Status:** Spec created 2026-11-14. **Ticket:** #202. **Card:** Spec Created.

## 1. Ticket

Today only the web-app reads feature flags. `featureFlagService.getTreatment`
exists in `backend/` but has **no callers**. It also throws on a DynamoDB
error and doesn't reject a treatment the caller doesn't know. So no backend
change can ship dark and then be dialed up, which blocks #194 and #170.

This project makes `getTreatment` the backend's one flag read:
- It evaluates through `treatmentEvaluator.ts`: overrides first, then
  allocations, then the default.
- It reads once per call and is built lazily (CLAUDE.md §5.2). Nothing is
  cached across warm invocations.
- **It never throws.** A missing flag, a failed read, a malformed row, a
  missing table env var or an unknown treatment all return the caller's
  fallback (`C`) with a WARN.
- Every read emits one `FeatureFlagRead` log line, which carries the read's
  outcome and its duration.
- `cdk/` gains a `GetItem`-only grant and the metric filters that any calling
  Lambda attaches.

## 2. Verification

**The ticket's block, as it stands after Celestine's answers (11-10 and 11-14):**
- **Metric:** the share of backend flag reads that return a treatment
  without error.
- **Query:** CloudWatch, from the `FeatureFlagRead` log line. It is not
  warehouse SQL.
- **Target:** at least 99.9% successful reads, adding under 20 ms to p99.
- **Window:** 7 days after the first caller ships.
- **Guardrails:** the calling Lambda's error rate and p99 don't regress.
- **What decides it:** the fail-safe behaviour, proved by unit tests and the
  `FeatureFlagRead` outcome counts. Latency is a guardrail.

| # | What | How | Before (2026-11-14) | Proves it works |
|---|---|---|---|---|
| **V1 (decides)** | Fail-safe read, both outcomes | Vitest in `backend/tests/service/featureFlag/featureFlagService.test.ts`, one case per path: <br>• valid flag via override, allocation and default → `TREATMENT`; <br>• flag missing → `FALLBACK` / `FLAG_MISSING`; <br>• DynamoDB throws → `READ_FAILED`; <br>• row fails zod → `READ_FAILED`; <br>• `FEATURE_FLAGS_TABLE_NAME` unset → `READ_FAILED`; <br>• treatment not in the caller's `treatments` → `UNKNOWN_TREATMENT`. <br>Each case asserts the returned value, that nothing was thrown and the logged fields. Coverage ≥ 90% per file | A DynamoDB error and a malformed row both **throw** out of `getTreatment`. Nothing rejects an unknown treatment. No `FeatureFlagRead` line exists | Every case passes, and the function has no path that throws |
| V2 | cdk grant and filters | `aws-cdk-lib/assertions` tests: the grant is `dynamodb:GetItem` on the one table's ARN and nothing else. The three metric filters (§3) exist on a given log group | No reusable grant exists. The API Lambdas use `grant(…"Scan","GetItem")` inline | The template tests pass |
| V3 | Success rate, live | In the first caller's hold (#194 or #170): <br>`FeatureFlagReadSucceeded / (FeatureFlagReadSucceeded + FeatureFlagReadFellBack)` from CloudWatch (namespace `Nyc311/FeatureFlags`, dims `FunctionName`, `FlagKey`), over the 7-day window. <br>Cross-check with Logs Insights on the caller's log group: <br>`filter message = "FeatureFlagRead" \| stats count(*) by outcome, reason, treatment` | **None exists:** there are no backend reads. `getTreatment` has 0 callers (grep of `backend/service`, `backend/controller`). Celestine accepted recording "no baseline" (11-10) | ≥ 99.9% `TREATMENT`. In Test (row `T1`), every line reads `treatment = T1` |
| V4 (guardrail) | Added latency | `FeatureFlagReadDurationMs` p99 over the same window, < 20 ms. Baseline query on `/aws/lambda/Nyc311FeatureFlagsApi-Prod` over the 7 days before the first caller's `T1` step: <br>`filter @type = "REPORT" \| fields ispresent(@initDuration) as cold \| stats count(*), pct(@duration,50) as p50, pct(@duration,99) as p99 by cold` <br>plus `filter message = "TreatmentEvaluated" \| stats count(*)` | **To be measured** at the start of the first caller's hold, before its `T1` step (Celestine, 11-14). The profile `nyc311-gen-purpose-dev` still doesn't exist on this host (checked 2026-11-14) | p99 < 20 ms, and the caller's p99 and error rate within its own spec's guardrails |

The read path is live today: `get_flag MARKETING_PAGE` returned version 6
from Prod (2026-11-14). That is the same table and the same `GetItem`.

## 3. Flag

**None of its own.** The read can't be flagged, because it is the flag. It
ships with no caller, so it is dark by construction. Its first dial-up is the
first caller's own flag: `NEAREST_OPERATOR_DISPATCH` (#194) or
`EVENT_DRIVEN_DISPATCH` (#170).

**The API the callers use**, compatible with #194's and #170's specs:

```ts
getTreatment(flagKey, context, { fallback: "C", treatments?: ["C", "T1"] }, deps?)
  : Promise<string>   /* never rejects */
```

**The log line,** one per read:

```
message: "FeatureFlagRead"
level:   "info" for TREATMENT, "warn" for FALLBACK
fields:  flagKey, outcome (TREATMENT | FALLBACK),
         reason (OVERRIDE | ALLOCATION | DEFAULT | FLAG_MISSING | READ_FAILED | UNKNOWN_TREATMENT),
         treatment, flagVersion?, durationMs, functionName (AWS_LAMBDA_FUNCTION_NAME),
         errorName? (on READ_FAILED)
```

**The metric filters,** from the new `cdk/lambda/FeatureFlagReadMetricFilters.ts`
construct (namespace `Nyc311/FeatureFlags`):
- `FeatureFlagReadSucceeded`: count where `outcome = TREATMENT`;
- `FeatureFlagReadFellBack`: count where `outcome = FALLBACK`;
- `FeatureFlagReadDurationMs`: the value of `$.durationMs`.

All three use dimensions `FunctionName` and `FlagKey`. Function names carry
`-Test` or `-Prod`, which keeps the two environments apart in the one
account.

## 4. Legs

| Leg | Change | Packages | Depends on | Verified by | PR | State |
|---|---|---|---|---|---|---|
| 1 | **`backend/`:** `getTreatment` catches every error and returns `fallback`. It gains the `treatments` option and logs `FeatureFlagRead` with `durationMs` (injectable `now`). `TreatmentFallbackUsed` is replaced by that line. **`cdk/`:** `FeatureFlagsTable.grantFlagRead(grantee)` (`GetItem` only) and the `FeatureFlagReadMetricFilters` construct, both unused until a caller wires them in | `backend/`, `cdk/` | none | V1, V2; Operational Loop in both packages | | Not started |

Callers wire in through their own first leg: #194 Leg 1 and #170 Leg 2. Each
one:
- calls `grantFlagRead`;
- sets `FEATURE_FLAGS_TABLE_NAME`;
- attaches the metric filters to its log group;
- passes `treatments: ["C","T1"]`.

## 5. Dial-up plan

There is none for #202 itself (Celestine, option (a), 11-10). The plan runs
inside the first caller's own `C` → 100% `T1` step:

1. **Before that caller's `T1` step:** take V4's latency baseline. Also
   confirm that `FeatureFlagRead` lines appear at `C`. With the `C` row in
   Prod, `outcome = TREATMENT` and `treatment = C`.
2. **Throughout the caller's hold, on every run:**
   - V3's success rate;
   - V4's p99 duration;
   - the caller's error rate and p99.
3. **Abort:** if the success rate falls below 99.9%, or the read's p99
   reaches 20 ms or more, or the caller's guardrail is breached, the caller's
   flag goes back to `C`. Then fix the read before dialing up again.
   Fallbacks already return `C`, so a failing read never turns `T1` on.

## 6. Verification log

| Date | Step | Result | Numbers |
|---|---|---|---|
| 2026-11-14 | Before | Recorded (§2) | 0 backend callers. Success rate: none exists. Latency: to be measured |

## 7. Outcome

Not yet.

## 8. Needs the CEO

- **No flag rows.**
- **Set up the read-only AWS profile `nyc311-gen-purpose-dev`** (role
  `Nyc311EngineerAgentRole`) on the Mac mini before the first caller's hold.
  V3 and V4 both need it.

## Appendix: decisions

- **Harden the existing `getTreatment` rather than add a new function.** It
  is already the in-process entry point, with 0 callers, and #194's spec
  already names it. The HTTP path (`evaluateFeatureFlag`) keeps throwing
  `NotFoundError`, so a 404 stays a 404.
- **"Unknown treatment"** means a treatment outside the caller's
  `treatments` list. The zod schema already guarantees the flag's own
  treatments are declared, so the remaining risk is a row that holds a
  treatment the code doesn't handle (for example `T2`). The list is
  optional, so a caller with open-ended treatments can omit it.
- **The metric filters live in a reusable construct**, so each caller adds
  one line instead of copying three filters. It follows the Poller's
  `MetricFilter` pattern (`1-data-ingestion.md` §8).
- **No alarm in this leg.** No caller exists yet, and the first caller's
  hold is checked on every run. An alarm can follow with the flag-cleanup
  work.
- **Rejected: a canary caller** (option (b), 11-10). Celestine chose (a).
- **Assumption:** `durationMs` covers the `GetItem` and the evaluation, not
  client construction. The `REPORT` duration on the API Lambda is a loose
  upper bound for it, which is why V4's baseline is a guardrail and not the
  decider.
