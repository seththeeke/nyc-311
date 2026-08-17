# Pipeline Monitoring — Design Doc

> Negotiated **2026-08-16**, same progressive/negotiated style as
> `1-data-ingestion.md` / `data-model.md` / `ddb-design.md` /
> `testing-framework.md`. Scopes and designs a new public Monitoring tile
> that mirrors `Nyc311Pipeline`'s AWS console status view — read-only,
> account-wide, no auth.
>
> This is a **design doc, not a build authorization** — treat it as the
> concrete plan a future build session works against, so that work doesn't
> re-derive these decisions mid-implementation. Explicitly written to be
> "full proof" per the project owner's framing: every cross-stack/bootstrap
> wrinkle this feature hits is documented here, not discovered later.

---

## Decision Status

| Topic | Status |
|---|---|
| [1. Scope](#1-scope) | **Agreed** |
| [2. Why this can't live in `Nyc311Stack`](#2-why-this-cant-live-in-nyc311stack) | **Agreed** |
| [3. Data source & IAM](#3-data-source--iam) | **Agreed** |
| [4. Response shape](#4-response-shape) | **Agreed** |
| [5. Backend architecture](#5-backend-architecture) | **Agreed** |
| [6. CDK architecture](#6-cdk-architecture) | **Agreed** |
| [7. Cross-stack CORS](#7-cross-stack-cors) | **Agreed** |
| [8. Frontend architecture](#8-frontend-architecture) | **Agreed** |
| [9. The pipeline-status API URL doesn't need runtime injection](#9-the-pipeline-status-api-url-doesnt-need-runtime-injection) | **Agreed** |
| [10. Bootstrap sequence](#10-bootstrap-sequence) | **Agreed** |
| [11. Visibility & security](#11-visibility--security) | **Agreed** |
| [12. Testing](#12-testing) | **Agreed** |
| [13. Naming reference](#13-naming-reference) | **Agreed** |

---

## 1. Scope

**Read-only status mirror.** Pipeline + stage + action status, timing, and
trigger info (commit SHA/message), refreshed on a fixed poll while the
page is open. This is exactly what `codepipeline:GetPipelineState` /
`ListPipelineExecutions` / `GetPipelineExecution` already expose — the
same data manually polled via the AWS CLI throughout earlier sessions to
babysit deploys by hand.

**Explicitly out of scope for this slice:**

- **CodeBuild log drill-down.** Diagnosing *why* a step failed still means
  opening the real AWS console. Adding this later is a real, separate
  scope increase (CloudWatch Logs read access, log-payload size/pagination,
  picking which lines matter) — not a small addition to this slice.
- **Any write/interactive action** (retry a stage, manually start an
  execution, approve anything). This pipeline has no manual-approval step
  by design (full CD, `aws-code-pipeline-plan.md`) — a public page with
  write capability against production CI/CD would cut directly against
  that philosophy. If this is ever wanted, it needs its own auth story
  first (see §11) — not bundled into this slice.

---

## 2. Why this can't live in `Nyc311Stack`

Every other feature so far (`Nyc311Api`, `Nyc311MetricsApiLambda`) lives in
`Nyc311Stack`, deployed twice — once as `Nyc311-Test`, once as
`Nyc311-Prod` — because the data behind them (`Requests-Test` /
`Requests-Prod`) is genuinely per-environment.

`Nyc311Pipeline` is not per-environment. There is exactly **one**
CodePipeline for the whole account (`cdk/pipeline/Nyc311PipelineStack.ts`),
covering Source → Synth → Self-Mutate → Deploy `test` → `cdk diff` →
Deploy `prod`. A pipeline-status API is inherently a singleton resource —
it belongs alongside the pipeline it reports on, in
`Nyc311PipelineStack`, not duplicated into `Nyc311Stack`'s per-environment
deploy.

This is a direct application of `CLAUDE.md` §5.3's already-standing
exception: *"the self-mutating AWS CodePipeline is CI/CD tooling, not
application infrastructure, and is permitted its own CloudFormation
stack."* A pipeline-status reporting API is CI/CD tooling by the same
reasoning — it doesn't need (and re-litigating the single-stack rule for
it doesn't apply).

**Consequence:** both the Test site and the Prod site's Monitoring pages
call the exact same pipeline-status API URL. There's no "Test's view of
the pipeline" vs. "Prod's view" — it's one pipeline, one API, one URL,
embedded identically into both deployed sites. This shapes §7 and §9
below.

---

## 3. Data source & IAM

Three read-only CodePipeline API calls, via a new backend dependency
(`@aws-sdk/client-codepipeline`, not yet installed):

| Call | Gives |
|---|---|
| `GetPipelineStateCommand` | Current state: every stage, and within each stage every action, each with its own `latestExecution.status` and `lastStatusChange` |
| `ListPipelineExecutionsCommand` | Recent execution summaries (status, start/update time, trigger) — capped to the last 10 (§4) |
| `GetPipelineExecutionCommand` | Per-execution detail, specifically `artifactRevisions[].revisionSummary` (the commit message JSON) that `ListPipelineExecutions` doesn't include — called once per execution in the history list |

**IAM**: exactly these three actions, scoped to the pipeline's own ARN —
`pipeline.pipeline.pipelineArn` (the underlying `codepipeline.Pipeline` L2
that `Nyc311PipelineStack.ts` already reaches into for
`.notifyOn(...)`), not `*`. Least privilege, same convention as every
other Lambda in this project (`Nyc311PollerLambda`,
`Nyc311MetricsApiLambda`).

```typescript
this.pipelineStatusLambda.addToRolePolicy(new iam.PolicyStatement({
  actions: [
    "codepipeline:GetPipelineState",
    "codepipeline:ListPipelineExecutions",
    "codepipeline:GetPipelineExecution",
  ],
  resources: [pipeline.pipeline.pipelineArn],
}));
```

**Rate/cost note**: at 10 executions of history and a 30s client poll
(§8), one page load is 1 `GetPipelineState` + 1 `ListPipelineExecutions` +
up to 10 `GetPipelineExecution` calls = ~12 API calls per poll tick, per
open tab. At this project's traffic (effectively one operator checking in
occasionally), this is nowhere near CodePipeline's API throttling limits —
not a real concern, not engineered around further.

---

## 4. Response shape

One endpoint, `GET /pipeline/status`, returning both halves of the
console's single pipeline page in one response (the live stage diagram and
the execution history list below it) — no reason to split into two round
trips for a page that always wants both at once.

```typescript
// backend/models/pipelineStatus.ts
export const PipelineActionStatusSchema = z.enum([
  "InProgress", "Succeeded", "Failed", "Cancelled", "Stopped", "Superseded", "Abandoned",
]); // the exact CodePipeline action-execution status enum, passed through as-is — see the
    // "no hardcoded stage/action names" rule below for why this is a enum passthrough, not a remapped one

export const PipelineActionSchema = z.object({
  actionName: z.string().min(1),
  status: PipelineActionStatusSchema.nullable(), // null: action has never run (e.g. Prod on a from-scratch pipeline)
  lastStatusChange: z.string().min(1).nullable(),
  summary: z.string().nullable(), // CodePipeline's own human-readable summary, when present
});

export const PipelineStageSchema = z.object({
  stageName: z.string().min(1),
  actions: z.array(PipelineActionSchema),
});

export const PipelineExecutionSchema = z.object({
  executionId: z.string().min(1),
  status: z.string().min(1), // pipeline-execution status — a slightly different enum than action status; passthrough, same reasoning
  startTime: z.string().min(1).nullable(),
  lastUpdateTime: z.string().min(1).nullable(),
  commitId: z.string().min(1).nullable(), // null for a StartPipelineExecution-triggered run (self-mutation restart, not a push)
  commitMessage: z.string().min(1).nullable(),
});

export const PipelineStatusResponseSchema = z.object({
  pipelineName: z.string().min(1),
  stages: z.array(PipelineStageSchema),
  executions: z.array(PipelineExecutionSchema), // most recent first, capped to 10
});
```

**No hardcoded stage or action names anywhere** — not in this schema, not
in the frontend that renders it. `stages`/`actions` are whatever
`GetPipelineState` returns, in the order it returns them. This is the
single most important "full proof" property of this design: when a new
stage is added later (the SAM CLI/Step-Functions-Local sanity stage and
the real-integration-test stage are both already flagged as "added later"
in `aws-code-pipeline-plan.md` §5), it shows up on the tile automatically,
with zero code changes here. A hardcoded stage list would silently go
stale the next time the pipeline's shape changes — exactly the kind of
future touch-up this doc is trying to design away.

---

## 5. Backend architecture

Same controller → service → model layering as the ingestion-metrics slice
(`CLAUDE.md` §5.2), including the "controllers never touch a
DAO/AWS-SDK-client directly" rule — here that's a CodePipeline client
instead of a DynamoDB one, same principle:

- `backend/models/pipelineStatus.ts` — the schemas above.
- `backend/service/pipeline/pipelineStatusService.ts` — owns the
  `CodePipelineClient` construction (module-scope singleton, same
  Lambda-cold-start-reuse pattern as `nyc311PollerService.ts` owning
  `RequestDao`), exposes `getPipelineStatus(): Promise<PipelineStatusResponse>`.
  Reads the pipeline name from an env var (`PIPELINE_NAME`, set by CDK to
  the literal `"Nyc311Pipeline"`) rather than hardcoding it a second time
  in application code.
- `backend/controller/web-api/getPipelineStatusController.ts` — validates
  the HTTP API v2 event via the existing shared
  `ApiGatewayHttpEventSchema` (`backend/models/apiGatewayHttpEvent.ts`,
  already generic, no ingestion-specific fields — reused as-is), calls the
  service, maps errors to HTTP status codes (`ValidationError` → 400,
  else → 500) — same shape as `getPollerMetricsController.ts`.

---

## 6. CDK architecture

New constructs under `cdk/pipeline/` (not `cdk/api/`, which stays scoped
to `Nyc311Stack`'s app-facing API — this resource is part of the pipeline
stack, so it lives with the pipeline's other constructs):

- `cdk/pipeline/Nyc311PipelineStatusLambda.ts` — `NodejsFunction` wrapping
  `getPipelineStatusController`, same bundling pattern as every other
  Lambda (`entry`/`handler`/`projectRoot`/`depsLockFilePath` pointed at
  `backend/`). Env: `PIPELINE_NAME`. Grant: the three read actions from §3.
- `cdk/pipeline/Nyc311PipelineStatusApi.ts` — a **second, separate**
  `HttpApi` (not an extra route on `Nyc311Api` — that construct lives in
  `Nyc311Stack` and is deployed per-environment; this one is a singleton
  living in `Nyc311PipelineStack`). One route: `GET /pipeline/status`.
  CORS per §7.
- Both wired into `Nyc311PipelineStack.ts`'s constructor, alongside the
  existing `pipeline`/`failureTopic`/`denyDirectDeploy` resources. A
  `CfnOutput` (`Nyc311PipelineStatusApiUrl`) exposes the URL the same way
  `Nyc311Stack.ts` already does for `Nyc311ApiUrl` — readable via
  `aws cloudformation describe-stacks --stack-name Nyc311PipelineStack`
  for the bootstrap step in §10 and for any future `test-scripts/` script.

---

## 7. Cross-stack CORS

The new API needs to allow requests from **both** `Nyc311Web-Test`'s and
`Nyc311Web-Prod`'s CloudFront domains (per §2 — one API, both sites call
it) — and those domains live in `Nyc311Stack`, a different stack from
`Nyc311PipelineStack`.

**Decision: hardcode both domains as constants in
`Nyc311PipelineStatusApi.ts`**, the same pattern `Nyc311PipelineStack.ts`
already uses for `GITHUB_OWNER`/`GITHUB_CONNECTION_ARN`:

```typescript
// Nyc311Web-Test / Nyc311Web-Prod CloudFront distributions
// (cdk/web/WebsiteHosting.ts) — hardcoded, not cross-stack-referenced;
// see 2-pipeline-monitoring.md §7 for why.
const TEST_WEB_DOMAIN = "d3u5wagmbm10bm.cloudfront.net";
const PROD_WEB_DOMAIN = "d3n0h6hoc7c771.cloudfront.net";
const LOCAL_DEV_ORIGIN = "http://localhost:5173";
```

A cross-stack reference (Nyc311Stack exporting each CloudFront domain via
SSM Parameter Store, Nyc311PipelineStack reading both at synth time) was
considered and rejected: it's more "self-updating," but it adds real
coupling — parameter naming/ownership, an implicit deploy-ordering
dependency — for a scenario (a `WebsiteHosting` CloudFront distribution
ever being replaced, changing its domain) that's unlikely in practice
(CloudFront distributions are long-lived; nothing in `WebsiteHosting.ts`
forces replacement short of a deliberate breaking config change). If that
ever does happen, this is a one-line manual update here — an accepted,
explicitly-named tradeoff, not an oversight.

---

## 8. Frontend architecture

Same shape as the ingestion-metrics slice, one-for-one:

- `web-app/src/models/pipelineStatus.ts` — mirrors the backend schemas
  (type + zod), per `CLAUDE.md` §5.1's network-boundary validation rule.
- `web-app/src/services/pipelineStatusService.ts` — mock/live
  implementations selected by `config.dataMode`, same interface pattern as
  `pollerMetricsService.ts`. Needs `web-app/src/test-data/pipelineStatus.ts`
  — a small hand-written fixture (a few stages, a mix of
  Succeeded/InProgress/Failed actions, a handful of execution-history
  rows including a `Cancelled`/`Superseded` pair) so mock mode can exercise
  every visual state without a live pipeline.
- `web-app/src/hooks/usePipelineStatus.ts` — TanStack Query,
  `refetchInterval: 30_000`. **No adaptive/background logic** — the
  "keep the browser light" requirement is satisfied structurally, not by
  extra client code: TanStack Query only polls while a component using the
  hook is mounted (unmount tears down the interval automatically) and
  defaults `refetchIntervalInBackground` to `false` (a backgrounded browser
  tab stops polling on its own). As long as this hook is only called from
  the dedicated page below — never from `MonitoringPage.tsx` itself — the
  poll genuinely only runs while a visitor is looking at this specific
  page, satisfying the requirement with zero bespoke lifecycle code.
- `web-app/src/components/pipeline/` — new subfolder (mirrors
  `components/ingestion/`), holding a stage/action status view and an
  execution-history list. Status coloring reuses the same validated status
  palette already established for ingestion metrics
  (`components/ingestion/palette.ts`'s `statusGood`/`statusCritical`/
  `statusWarning`) rather than re-deriving a new one — plus a neutral/blue
  "in progress" treatment and a muted-gray treatment for
  `Cancelled`/`Stopped`/`Superseded` (not a failure, just superseded — a
  real, common state given the self-mutation-restart pattern; see the
  addendum this doc's design pulled from, `1-data-ingestion.md`'s sibling
  session notes, for what that actually looks like in practice). Same
  dataviz-skill rules apply: icon + label for every status mark, never
  color alone; a legend; a table-view-equivalent (the execution history
  list itself already *is* the accessible table view here, structurally,
  unlike a chart needing a separate twin).
- `web-app/src/components/pages/PipelineMonitoringPage.tsx` — new page,
  route `/monitoring/pipeline` (added to `AppRoutes.tsx`, `PublicRoute`
  tier — see §11). `MonitoringPage.tsx`'s `MONITORING_TILES` array gets a
  new `{ title: "Pipeline", description: "...", to: "/monitoring/pipeline" }`
  entry, same mechanical pattern as the existing "Ingestion" tile.

---

## 9. The pipeline-status API URL doesn't need runtime injection

`web-app/src/config.ts`'s `loadRuntimeConfig`/`env-config.json` mechanism
(`1-data-ingestion.md` §8a) exists to solve one specific problem: the CI
pipeline builds `web-app/dist` **once** and deploys the identical bundle to
both `Nyc311-Test` and `Nyc311-Prod`, but each environment's ingestion API
has its own, different URL — so that value can't be a Vite build-time env
var (fixed at build time, one value for the whole shared build).

The pipeline-status API doesn't have that problem: per §2, it's the exact
same URL in both environments. There's nothing to inject per-deploy — the
value is identical everywhere, forever (barring the API itself being torn
down and recreated). So this is simply a Vite **build-time** env var,
read directly, no runtime fetch involved:

```typescript
// web-app/src/config.ts — one new field, no new mechanism
pipelineApiBaseUrl: import.meta.env.VITE_PIPELINE_API_BASE_URL || "",
```

Set once in a new **checked-in** `web-app/.env` (not `.env.local`, which
is git-ignored and personal — this value is the same for every developer
and every deployed environment, so it belongs in source control):

```
# web-app/.env
VITE_PIPELINE_API_BASE_URL=<Nyc311PipelineStatusApiUrl, filled in during bootstrap — see §10>
```

`web-app/vite-env.d.ts`'s `ImportMetaEnv` interface gains the matching
`VITE_PIPELINE_API_BASE_URL: string` declaration alongside the existing
two.

---

## 10. Bootstrap sequence

Because `web-app/.env` needs the API's URL, and that URL doesn't exist
until `Nyc311PipelineStatusApi` is deployed once, this feature has a
genuine two-step rollout — the *only* manual step this design needs, and
it happens exactly once:

1. **Ship the CDK + backend changes** (§5, §6) — commit and push as usual.
   The self-mutating pipeline picks it up like any other
   `Nyc311PipelineStack.ts` change (`aws-code-pipeline-plan.md` §1.1):
   Synth → Self-Mutate (applies the new stack definition, creating
   `Nyc311PipelineStatusLambda`/`Nyc311PipelineStatusApi`) → the pipeline
   restarts itself under the new structure, same self-mutation-restart
   pattern already observed and handled in earlier sessions — no new
   mechanism, just the existing one doing its job.
2. **Read the new API's URL** once `Nyc311PipelineStack` finishes
   updating: `aws cloudformation describe-stacks --stack-name
   Nyc311PipelineStack --profile nyc311 --query
   "Stacks[0].Outputs[?OutputKey=='Nyc311PipelineStatusApiUrl'].OutputValue"`.
3. **Fill it into `web-app/.env`**, commit, push. This deploy carries the
   frontend changes (§8) *and* now has the real API URL baked into the
   build — the same push that finally makes the tile functional on both
   `Nyc311-Test` and `Nyc311-Prod`.

After step 3, this is genuinely done — no further manual step, matching
"shouldn't need to touch after I make it once." The bootstrap is a
property of *creating* a new singleton resource and wiring a consumer to
it for the first time, not an ongoing maintenance burden.

---

## 11. Visibility & security

**Fully public, no auth** — same tier as the Ingestion tile
(`PublicRoute`, `CLAUDE.md` §5.1). This project's commit history is
descriptive feature work, nothing sensitive; the pipeline's real
CloudWatch/console access stays IAM-gated separately regardless. Adding
real authentication is a materially bigger, separate effort (no
`AuthenticatedRoute` exists anywhere in the app yet, despite `CLAUDE.md`
§5.1 anticipating the tier split) and isn't bundled into this slice.

---

## 12. Testing

Same four-tier model as every other slice (`testing-framework.md`):

- **Unit**: `CodePipelineClient` mocked via `aws-sdk-client-mock` (already
  a `backend` dev dependency, same tool used for DynamoDB), same pattern
  as `nyc311PollerService.test.ts`/`requestDao.test.ts`. 90% per-file gate,
  no exception.
- **CDK assertions**: `Nyc311PipelineStatusLambda`/`Nyc311PipelineStatusApi`
  synthesized and asserted the same way as `Nyc311MetricsApiLambda`/
  `Nyc311Api` — IAM policy scoped to the pipeline ARN (not `*`), CORS
  allow-list contains exactly the two hardcoded domains + localhost,
  route exists.
- **Frontend**: component/hook tests mocking `pipelineStatusService`, same
  pattern as `usePollerMetrics.test.tsx`/`IngestionMonitoringPage.test.tsx`.
- **Real integration**: a new `test-scripts/3-pipeline-status-test.py`
  (matching `1-ingestion-test.py`/`2-metrics-api-test.py`'s existing
  style) — looks up the URL via `Nyc311PipelineStatusApiUrl` the same way
  `2-metrics-api-test.py` does for `Nyc311ApiUrl`, hits `GET
  /pipeline/status`, and confirms the response is well-formed and
  contains at least the stages this project's own pipeline is known to
  have (`Source`, `Build`, `UpdatePipeline`, `DeployTest`, `DeployProd`)
  — a real-world sanity check, not a hardcoded expectation the frontend
  itself depends on (§4's "no hardcoded stage names" rule is about the
  *product* code, not this one verification script).

---

## 13. Naming reference

| Piece | Path |
|---|---|
| Backend model | `backend/models/pipelineStatus.ts` |
| Backend service | `backend/service/pipeline/pipelineStatusService.ts` |
| Backend controller | `backend/controller/web-api/getPipelineStatusController.ts` |
| CDK Lambda | `cdk/pipeline/Nyc311PipelineStatusLambda.ts` |
| CDK API | `cdk/pipeline/Nyc311PipelineStatusApi.ts` |
| Frontend model | `web-app/src/models/pipelineStatus.ts` |
| Frontend service | `web-app/src/services/pipelineStatusService.ts` |
| Frontend mock data | `web-app/src/test-data/pipelineStatus.ts` |
| Frontend hook | `web-app/src/hooks/usePipelineStatus.ts` |
| Frontend components | `web-app/src/components/pipeline/` |
| Frontend page | `web-app/src/components/pages/PipelineMonitoringPage.tsx` |
| Route | `/monitoring/pipeline` (`AppRoutes.tsx`) |
| New checked-in env file | `web-app/.env` (`VITE_PIPELINE_API_BASE_URL`) |
| Manual verification script | `test-scripts/3-pipeline-status-test.py` |

---

## Still Open

Nothing — every fork raised during negotiation (scope, stack placement,
CORS, refresh behavior, execution history depth, visibility, the runtime-
vs-build-time config question) was resolved above. The only thing this
doc doesn't cover is implementation itself — that's a follow-up build
session's job, working from this doc the same way the ingestion-metrics
slice was built from `1-data-ingestion.md` §8a's design.
