---
name: create-feature-flag
description: Adds a new C/T1 feature flag end to end - the web-app gate (constants, useFeatureEnabled or FeatureFlagRoute, mock row, tests), the FeatureFlags-Test (T1) and FeatureFlags-Prod (C) DynamoDB rows after explicit confirmation, and a backlog issue (via log-backlog-item) to remove the flag before it lingers. Use whenever the user asks to put something behind a flag, hide a feature behind a flag, or create a feature flag.
---

# Create Feature Flag

A flag here is a row in the `FeatureFlags-<Env>` DynamoDB table. The web-app
reads its treatment from the public `POST /feature-flags/{flag_key}/treatment`
route and shows the gated thing only on the "on" treatment. Nothing in
`backend/` reads product flags today; only the web-app gates on them.

## Defaults (unless the user says otherwise)

- **Key:** `ALL_CAPS_SNAKE` (CLAUDE.md §6), e.g. `AGENT_CONTRIBUTIONS`.
- **Treatments:** `["C", "T1"]`. `C` = control (hidden / old behaviour), `T1` = on.
- **Test:** `default_treatment` **`T1`**. **Prod:** `default_treatment` **`C`**.
- **Mock mode:** `T1`, so `npm run dev` in mock mode shows the feature.
- Turning it on in Prod is the user's step (Admin → Feature Flags), never yours.

## 1. Web-app gate

1. **Constants** in `web-app/src/models/featureTreatment.ts`, one comment line
   saying what it gates and what C/T1 mean:
   ```ts
   /* AGENT_CONTRIBUTIONS gates Meet the Team's View Contributions button and panel: C hides them, T1 shows them. */
   export const AGENT_CONTRIBUTIONS_FLAG = "AGENT_CONTRIBUTIONS";
   export const AGENT_CONTRIBUTIONS_ON = "T1";
   ```
2. **Gate**, picking the one that fits:
   - A whole page/route: wrap it in `FeatureFlagRoute` (`web-app/src/routes/FeatureFlagRoute.tsx`) in `AppRoutes.tsx`, with `onTreatments={[X_ON]}`; also hide its sidebar link with `useFeatureEnabled`.
   - A piece of UI: `useFeatureEnabled(X_FLAG, X_ON)` from `hooks/useFeatureTreatment.ts`. Missing, loading and failed flags all read as **off**, so code can ship before the rows exist.
   - Read the flag once at the page level and pass it down (e.g. a nullable callback prop) rather than calling the hook in every card.
   - Close every other way in too: a URL param, deep link or secondary-workspace panel that reaches the feature must also check the flag.
3. **Mock row** in `web-app/src/test-data/featureFlags.ts` (`MOCK_FEATURE_FLAGS`): same shape as the others, `default_treatment: "T1"`, today's date, `updated_by: "01MOCKADMIN"`; update the file's top comment list.
4. **Tests:**
   - `tests/services/featureFlagService.test.ts` asserts the mock keys **sorted**; add the new key in order.
   - Components using the hook: `vi.mock("<rel>/src/hooks/useFeatureTreatment", () => ({ useFeatureEnabled: vi.fn(() => true) }));` and add an "off" case with `vi.mocked(useFeatureEnabled).mockReturnValueOnce(false)` asserting the feature is gone.
   - A prop that became optional/nullable gets its own test for the hidden case.
5. **Docs:** in the design doc for the feature, state the flag, its treatments, and `T1` in `FeatureFlags-Test`, `C` in `FeatureFlags-Prod`.
6. **Operational Loop** (CLAUDE.md §2) in `web-app/`: `npm run build`, `npm run lint`, `npm run test:coverage` (90% per file). Not done until all three pass.

## 2. DynamoDB rows (mutating — confirm first)

Writing rows changes real AWS resources: per CLAUDE.md §3, show the user the
exact two rows and get explicit confirmation **immediately before** running.
Reads (`get-item`) need no confirmation.

1. Read an existing row first to copy the current shape and the CEO's
   `updated_by` id:
   ```
   aws dynamodb get-item --profile nyc311 --table-name FeatureFlags-Prod \
     --key '{"flag_key":{"S":"CONTACTS_PAGE"}}'
   ```
2. On confirmation, write both rows, conditioned on the flag not existing:
   ```bash
   NOW=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
   for pair in Test:T1 Prod:C; do env=${pair%%:*}; t=${pair##*:}
     aws dynamodb put-item --profile nyc311 --table-name FeatureFlags-$env \
       --condition-expression "attribute_not_exists(flag_key)" \
       --item "{\"flag_key\":{\"S\":\"<KEY>\"},\"description\":{\"S\":\"<what it gates> (#<cleanup issue>). C = hidden, T1 = shown.\"},\"treatments\":{\"L\":[{\"S\":\"C\"},{\"S\":\"T1\"}]},\"default_treatment\":{\"S\":\"$t\"},\"overrides\":{\"L\":[]},\"allocations\":{\"L\":[]},\"version\":{\"N\":\"1\"},\"created_at\":{\"S\":\"$NOW\"},\"updated_at\":{\"S\":\"$NOW\"},\"updated_by\":{\"S\":\"<updated_by from step 1>\"}}"
   done
   ```
   A `ConditionalCheckFailedException` means the flag already exists: stop and tell the user, never overwrite.
3. Read both rows back and report key, treatment and version per table.
4. Any later change goes through Admin → Feature Flags (it bumps `version`), not the CLI.

## 3. Cleanup issue (always)

Every flag is temporary. Use the **`log-backlog-item`** skill to file an issue
so it gets removed rather than lingering. Do this before the rows (step 2) so
the row descriptions can cite the issue number. The issue says:

- **Title:** `Remove the <KEY> feature flag`
- What the flag gates, and where it's read (the files from step 1).
- **Remove when:** the feature is on in Prod and stable (suggest ~2 weeks at `T1` in Prod), or it's abandoned.
- **Steps:** flip Prod to `T1` (if keeping it), delete the gate, the constants, the mock row and the flag-off tests, update the sorted keys in `featureFlagService.test.ts`, update the doc, then delete both DynamoDB rows (mutating — confirm first).
- A link to the feature's own issue, if there is one.

If the gated feature itself still needs building (the flag hides an unfinished
feature), that is a **separate** backlog issue; link the two.

## 4. Report

Tell the user: what's gated and how, the gate results, the two rows as written
(or that they're waiting on confirmation), and the cleanup issue URL. Commit
and push only when asked (CLAUDE.md §7).
