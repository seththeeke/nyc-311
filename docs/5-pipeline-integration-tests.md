# Pipeline Integration Tests

**Status: Shipped and verified 2026-08-24.** Live on both `Nyc311-Test`
and `Nyc311-Prod` — `IntegrationTestsTest` blocks `DeployProd` on
failure, `IntegrationTestsProd` runs as a non-blocking post-deploy smoke
check, and both publish `route-report.json` to their environment's
Monitoring page tile. One real bug found and fixed during rollout: the
first pipeline run's 8 GET-route tests actually passed against live
Test, but the step still failed — CodeBuild's `commands` array runs in
one continuous shell, so the `cd backend` from the test-run command
leaked into the next command, making `aws s3 cp` look for
`backend/backend/tests/integration/reports/route-report.json` instead of
the real path. Fixed by adding `&& cd ..` back to the repo root (§5), with
a regression test. Re-run succeeded end-to-end on both environments,
confirmed via `aws s3 cp ... -` on both buckets and a live browser check
of `/monitoring/integration-tests` on Test.

Implements `testing-framework.md` §4/§7's "Real integration" tier, which
was negotiated back on 2026-07-29 but never actually built. Scope, per
today's conversation: the 3 per-environment public GET routes, replacing
`test-scripts/2-metrics-api-test.py`/`3-orders-api-test.py` (NOT
`1-ingestion-test.py`, which smoke-tests the poller Lambda directly via
invoke + DynamoDB, a different concern this doc doesn't touch) with a real
TypeScript/Vitest suite wired into `Nyc311Pipeline`.

---

## 1. Decisions

| Question | Decision |
|---|---|
| Implement existing design or redesign? | Implement `testing-framework.md` §4/§7 as the spec. |
| Language/framework | TypeScript + Vitest. |
| Where does the suite live? | **Revised mid-design** (see §1.1) — `backend/tests/integration/`, extending infrastructure that already existed (`vitest.integration.config.ts`, one real test file) rather than a new root-level package. |
| How does "local" work? | `sam local start-api` (real API Gateway routing + real Lambda code, via Docker) — the *same* HTTP test suite runs against `local`, `test`, or `prod`, selected by `INTEGRATION_TARGET`. |
| Does the pipeline run the local/SAM target? | No. `local` is developer-workstation-only. The pipeline only ever runs the suite against real deployed Test/Prod APIs — sidesteps the privileged-Docker-in-Docker-CodeBuild question entirely. |
| Manual approval before Prod? | No — Prod keeps auto-deploying. The gate is the integration suite itself. |
| Does the suite gate Prod? | Yes, against **Test**: a failing run blocks `DeployProd` (a `post` step on `DeployTest`, same mechanism as `PublishCoverageTest`). |
| Does Prod get tested at all? | Yes — a **non-blocking** post-deploy smoke check (`post` step on `DeployProd`, always exits 0 regardless of pass/fail). |
| Which routes? | `/ingestion/metrics`, `/orders`, `/lambda-metrics` — not `/pipeline/status` (singleton, not per-environment). |
| Formal endpoint-coverage % gate? | Skipped — 3 routes, one test file per route by construction. |
| Any coverage visibility at all? | A lightweight, non-gating **route-hit report** — console summary + a Monitoring page tile. |

### 1.1 Mid-design pivot: location

The original plan (first draft of this doc) called for a brand-new
root-level `integration-tests/` package, on the premise that keeping
integration tests out of `backend/`'s coverage-gated unit-test run
required a separate package. Partway through, `backend/tests/integration/`
was found to **already exist** — `vitest.integration.config.ts` (its own
config, cleanly excluded from `backend/`'s `test`/`test:coverage` via that
config's own `exclude` array), a `test:integration` npm script, and one
real test file (`pollerMetricsApi.integration.test.ts`, added
2026-08-19, never wired into the pipeline). That existing setup already
solved the exact problem the new-package plan was designed around — so
the plan pivoted to extending it instead: no new npm package, no
`CLAUDE.md` amendment, and it reuses `backend/models/`'s zod schemas
directly (no cross-package schema duplication needed, since it's the same
package).

---

## 2. Package layout — `backend/tests/integration/`

```
backend/
  vitest.integration.config.ts    — own config: fileParallelism off, globalSetup prints the route report
  package.json                    — test:integration:local/test/prod scripts
  tests/integration/
    support/
      targets.ts                  — resolves BASE_URL for local/test/prod
      httpClient.ts                — thin fetch wrapper; every call goes through here so route hits are tracked
      routeTracker.ts              — read-modify-write against reports/route-report.json
      printReportSummary.ts        — Vitest globalSetup/teardown; prints the console summary table
    pollerMetricsApi.integration.test.ts   — GET /ingestion/metrics
    ordersApi.integration.test.ts          — GET /orders
    lambdaMetricsApi.integration.test.ts   — GET /lambda-metrics
    reports/                       — gitignored; route-report.json lands here on a run
```

**Schemas reused directly, no duplication.** `pollerMetricsApi` uses
`backend/models/pollerMetrics.ts`'s `PollerMetricsSchema` and
`ordersApi` uses `backend/models/order.ts`'s `OrderSchema` — both already
exist for backend's own internal use, and this suite is the same package,
so it just imports them. Two wire shapes have no existing schema by
design (`IngestionCursorStatus`, `LambdaHealth` — both backend-computed
output, not read from an external boundary within backend's own code,
per those files' own comments): each gets a small schema defined inline
in its own test file instead, since here — from the test's perspective —
the HTTP response genuinely is the external boundary.

**Real response envelopes** (confirmed by reading the controllers, not
assumed from the old Python scripts — `2-metrics-api-test.py` had gone
stale, missing the `cursor` field the 2026-08-22 incident work added):
- `GET /ingestion/metrics` → `{ metrics: PollerMetrics[], cursor: IngestionCursorStatus | null }`
- `GET /orders` → `{ orders: Order[], nextCursor: string | null }`
- `GET /lambda-metrics` → `{ lambdas: LambdaHealth[] }`

---

## 3. Target resolution — `local` / `test` / `prod`

`INTEGRATION_TARGET` env var selects the target (required — `targets.ts`
throws rather than defaulting, so a misconfigured run fails loudly
instead of the old `describe.skipIf(!API_URL)` pattern's silent skip).
Three npm scripts set it:

```json
"test:integration:local": "INTEGRATION_TARGET=local vitest run --config vitest.integration.config.ts",
"test:integration:test": "INTEGRATION_TARGET=test vitest run --config vitest.integration.config.ts",
"test:integration:prod": "INTEGRATION_TARGET=prod vitest run --config vitest.integration.config.ts"
```

`targets.ts`'s `getBaseUrl()` (lazily memoized — importing the module
never itself triggers a network/CLI call, only the first real request
does):
- `local` → `http://localhost:3000` (SAM CLI's `start-api` default port).
- `test`/`prod` → `API_BASE_URL` if already set (the pipeline's fast
  path, via `envFromCfnOutputs`), else `aws cloudformation
  describe-stacks --stack-name Nyc311-Test|Nyc311-Prod --profile nyc311`
  reading `Nyc311ApiUrl` — the same lookup the old
  `test-scripts/2-metrics-api-test.py`/`3-orders-api-test.py` did, so
  `npm run test:integration:test` still works for a developer with no
  env var set.

**Local caveat, documented not fixed:** `sam local start-api` runs the
*real* Lambda code from the *real* CDK-synthesized template
(`sam local start-api -t cdk.out/Nyc311-Test.template.json`), so its env
vars are real Test table names. The code still makes real AWS SDK calls
over the network — SAM/Docker emulates API Gateway + the Lambda execution
environment, not DynamoDB/CloudWatch. `local` requires a valid `nyc311`
AWS credential profile and reads real Test data (safe — all 3 routes are
read-only).

```
cd cdk && npx cdk synth Nyc311-Test --app "npx ts-node --prefer-ts-exts bin/app.ts"
sam local start-api -t cdk.out/Nyc311-Test.template.json --profile nyc311
# in a second terminal:
cd backend && npm run test:integration:local
```

---

## 4. Route-hit tracking + reporting

Not a blocking gate — visibility only. `routeTracker.ts` does a
read-modify-write against `reports/route-report.json`
(`{ target, ranAt, routes: { "<path>": { hit, statusCode, ok } } }`),
called by `httpClient.ts` after every request — independent of whatever
assertions the calling test makes afterward, so the report reflects "did
we reach it and get a response," not "did every assertion pass".
`vitest.integration.config.ts` sets `fileParallelism: false` so the 3
test files run serially, avoiding a write race on that shared file.

`printReportSummary.ts` is wired as Vitest's `globalSetup` (its
`teardown` export does the printing — `globalSetup` files run in a
separate context from the test files, so they read the report back from
disk rather than sharing in-memory state):

```
Route                   Hit   Status
/ingestion/metrics      yes   200
/orders                 yes   200
/lambda-metrics         yes   200
```

**Hosting the report (Monitoring page tile).** Unlike the coverage report
(external link to a large drill-down tree, deliberately outside the SPA),
a 3-route pass/fail table is small and renders inside the app:
- The pipeline's integration-test step `aws s3 cp`s `route-report.json`
  to `s3://nyc311-web-<env>/integration-tests/route-report.json` (same
  bucket/CloudFront reuse as coverage, same invalidation), regardless of
  whether the suite passed — so a failing run's report is never stale.
- `web-app/src/models/integrationTestReport.ts` (zod schema),
  `services/integrationTestReportService.ts` (fetches the same-origin
  static file directly — not `config.apiBaseUrl`, a different origin),
  `hooks/useIntegrationTestReport.ts` — the usual layering.
- `components/pages/IntegrationTestReportPage.tsx` at
  `/monitoring/integration-tests`, an internal route (not an external
  link-out like the coverage tile) rendering a route/status table.
- A 6th Monitoring page tile (indigo accent — the 5 existing ones were
  taken), linking to that internal route.

---

## 5. CDK pipeline wiring

`cdk/pipeline/Nyc311IntegrationTestStep.ts` — a factory
`createIntegrationTestStep(props)` mirroring
`Nyc311CoveragePublishStep.ts`'s shape, parameterized by:
- `target`: `"test"` or `"prod"`.
- `blocking`: `true` for Test, `false` for Prod.
- `apiUrlOutput`: that environment's `Nyc311Stack.apiUrlOutput` (via
  `Nyc311AppStage`), wired in via `envFromCfnOutputs: { API_BASE_URL:
  props.apiUrlOutput }` — not hardcoded, since the API URL isn't
  deterministic the way the coverage step's bucket/distribution are.

**Refactor to expose the output:** `Nyc311Stack.apiUrlOutput` (public
`CfnOutput`, same value as the existing `Nyc311ApiUrl` output — just also
kept as a reference) and `Nyc311AppStage.apiUrlOutput` (reads it off the
`Nyc311Stack` it wraps — the first thing exposed upward through that Stage
wrapper).

**Commands** (the test run's exit code is captured to a file, not
checked directly, so the sync/invalidate commands always run next
regardless of pass/fail — only the final `exit` actually fails the
action, and only when `blocking`):
```
cd backend && npm ci && (npm run test:integration:<target>; echo $? > /tmp/integration-test-exit-code)
aws s3 cp backend/tests/integration/reports/route-report.json s3://<bucket>/integration-tests/route-report.json
aws cloudfront create-invalidation --distribution-id <id> --paths "/integration-tests/*"
exit $(cat /tmp/integration-test-exit-code)     # Prod: exit 0 instead
```

**Shared bucket/distribution constants** were extracted from
`Nyc311CoveragePublishStep.ts` into `cdk/pipeline/websiteHostingTargets.ts`
(`WEBSITE_HOSTING_TARGETS`) — both steps publish onto the same
WebsiteHosting bucket, just under different prefixes (`/coverage/` vs.
`/integration-tests/`), so the hardcoded names/IDs are defined once.

**IAM**, least-privilege per environment: `s3:ListBucket` on the bucket,
`s3:GetObject`/`PutObject`/`DeleteObject` scoped to
`<bucket>/integration-tests/*` only, `cloudfront:CreateInvalidation`
scoped to that one distribution.

Wired into `Nyc311PipelineStack.ts` as an additional `post` step
alongside the existing coverage-publish step on each of `DeployTest`
(blocking) and `DeployProd` (non-blocking) — runs in parallel with
`PublishCoverage*`, no dependency between them.

---

## 6. `CLAUDE.md` changes

**None.** The original plan's new-package design needed a `CLAUDE.md`
amendment (a new top-level directory); extending
`backend/tests/integration/` fits entirely within `backend/`'s existing
§5.2 structure section (`tests/` already mirrors the code structure, and
this tier already existed there before today).

---

## 7. Testing plan (CLAUDE.md §2, for the packages it applies to)

- **`backend/`**: `npm run build && npm run lint && npm run test:coverage`
  — unaffected by the new `tests/integration/**` files (already excluded
  by `vitest.config.ts`'s own `exclude`). Separately,
  `npm run test:integration:test` run by hand against the live Test API
  to prove the suite itself is correct before it's ever gating anything
  (§9 rollout) — no coverage gate for this tier (not a percentage that
  means anything for a suite whose job is calling a real external
  system).
- **`cdk/`**: new `cdk/tests/pipeline/Nyc311IntegrationTestStep.test.ts`
  (blocking vs. non-blocking buildspecs, `API_BASE_URL` wiring, IAM
  scoping) and an added assertion in `Nyc311Stack.test.ts`
  (`apiUrlOutput` is exposed). 90%-per-file gate applies as usual.
- **`web-app/`**: tests for the new model/service/hook/page/tile, same
  pattern as the Lambda Health and coverage tiles. 90%-per-file gate
  applies as usual.

---

## 8. Rollout

1. Implement §2–§6.
2. Locally: `cd backend && npm run build && npm run lint`, then
   `npm run test:integration:test` against the live Test API, to prove
   the suite itself is correct before it's ever gating anything.
3. `backend/`, `cdk/`, `web-app/` build/lint/test/coverage (§7).
4. Delete `test-scripts/2-metrics-api-test.py` and
   `test-scripts/3-orders-api-test.py` (replaced) — **not**
   `1-ingestion-test.py` (different concern, untouched by this doc).
5. Single commit + push to `main`.
6. Watch `Nyc311Pipeline`: `Synth` → `UpdatePipeline` → `DeployTest` →
   (`PublishCoverageTest` + `IntegrationTestsTest`, parallel) →
   `ProdDiff` → `DeployProd` → (`PublishCoverageProd` +
   `IntegrationTestsProd`, parallel).
7. Verify: both `IntegrationTests*` actions show `Succeeded`; `s3 ls
   s3://nyc311-web-test/integration-tests/` (and `-prod`) shows
   `route-report.json`; the Monitoring page's new tile renders real
   pass/fail data in a browser, both environments.
