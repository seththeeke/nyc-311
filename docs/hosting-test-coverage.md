# Hosting Test Coverage

Follow-up to `99-things-to-come-back-to.md`'s "Publishing code coverage"
entry (discussed 2026-08-16). Resolves it by implementing the doc's
favored option — hosting the reports on the app's own CloudFront, no
third-party service — plus a Monitoring page entry point, per today's
(2026-08-23) request.

---

## 1. Decisions (confirmed with the user before implementation)

| Question | Decision |
|---|---|
| Where do reports live? | Reuse the existing `WebsiteHosting` bucket/CloudFront for each environment, under a new `/coverage/` prefix — not a dedicated bucket/distribution. |
| Which environment(s)? | Both `Nyc311Web-Test` and `Nyc311Web-Prod`. Coverage numbers are identical either way (Synth runs the suites once, before the Test/Prod stage fork) — this is really "does Prod's site carry internal tooling too," and the answer is yes. |
| Monitoring page UX? | A plain link-out tile — title/description only, opens the hosted report in a new tab. No live-fetched summary numbers on the tile itself (that was considered and explicitly declined in favor of the simpler option). |

This closes the "should the URL be public or gated somehow" question the
original doc left open too: CLAUDE.md's task instructions explicitly ask
for a Monitoring-page tile as the entry point, which supersedes that doc's
earlier hesitation about not linking it from the SPA. No auth layer exists
anywhere in the app today (`PublicRoute` is a no-op gate), so building one
just for this would be disproportionate; the reports themselves contain no
secrets, only file paths and coverage percentages.

---

## 2. Pipeline mechanics

### 2.1 Why a post-deploy step, not part of Synth

`Synth` (`Nyc311PipelineStack.ts`) already runs each package's
`npm run test:coverage`, which leaves `<pkg>/coverage/` (HTML report +
`coverage-summary.json`) sitting in that CodeBuild container — but that
container is torn down once Synth finishes, and the target S3 bucket
doesn't reliably exist yet on a from-scratch bootstrap anyway. So:

- Capture those three `coverage/` directories as **CDK Pipelines
  additional output FileSets** off the `synth` step
  (`synth.addOutputDirectory("backend/coverage")`, same for `cdk/coverage`
  and `web-app/coverage`) — no re-running any test suite.
- Add one new `pipelines.CodeBuildStep` **per environment**, wired as a
  `post` step on that environment's stage
  (`pipeline.addStage(stage, { post: [publishCoverageStep] })`). This
  guarantees the step only runs after that environment's `Nyc311Stack`
  deploy has succeeded, i.e. the bucket/distribution are guaranteed to
  already exist.

### 2.2 The new step — `cdk/pipeline/Nyc311CoveragePublishStep.ts`

A small factory, `createCoveragePublishStep(props)`, called twice from
`Nyc311PipelineStack.ts` (once per environment) with that environment's
bucket name / distribution ID / a step id (`"PublishCoverageTest"` /
`"PublishCoverageProd"`).

- `input`: the same `source` (`CodePipelineSource.connection(...)`) Synth
  and `ProdDiff` already reuse, so `scripts/` is present in the workspace.
- `additionalInputs`: the three FileSets from `synth.addOutputDirectory`,
  landing at their natural repo-relative paths (`backend/coverage`,
  `cdk/coverage`, `web-app/coverage`) — the same layout
  `scripts/rollup-coverage.js` already expects locally, so no path
  translation needed on the read side.
- `commands`:
  1. `npm ci` (repo root) — installs the `istanbul-lib-*` devDependencies
     §3's merge script needs; Synth's per-package `npm ci`s don't cover
     the repo root.
  2. `node scripts/publish-coverage.js` — merges the three packages'
     coverage into one report at `coverage-publish/` (see §3).
  3. `aws s3 sync coverage-publish/ s3://<bucket>/coverage/ --delete` —
     `--delete` so a renamed/removed source file doesn't leave an orphaned
     object behind.
  4. `aws cloudfront create-invalidation --distribution-id <id> --paths
     "/coverage/*"` — `CachePolicy.CACHING_OPTIMIZED`'s ~1-day default TTL
     would otherwise serve a stale report to whoever hits `/coverage/*`
     mid-cache-window.
- `rolePolicyStatements` (least-privilege, not a blanket bucket grant):
  - `s3:ListBucket` on the bucket ARN.
  - `s3:GetObject` / `s3:PutObject` / `s3:DeleteObject` scoped to
    `<bucket-arn>/coverage/*` only — this step can't touch the SPA's own
    files at the bucket root.
  - `cloudfront:CreateInvalidation` scoped to that one distribution's ARN.
- No `partialBuildSpec` override needed — `codeBuildDefaults` on the
  `CodePipeline` construct (Node 20 runtime, `STANDARD_7_0` image) already
  applies to every CodeBuild-backed action in the pipeline, this one
  included.

### 2.3 Bucket name / distribution ID: hardcoded constants, not cross-stack refs

`nyc311-web-test` / `nyc311-web-prod` (confirmed via `aws s3 ls
--profile nyc311`) and `E1EFLKB8JSXGXU` / `E1FXE4OBQCY52G` (confirmed via
`aws cloudfront list-distributions --profile nyc311`) are hardcoded as
constants in `Nyc311CoveragePublishStep.ts`, the same way
`Nyc311PipelineStatusApi.ts` already hardcodes `TEST_WEB_DOMAIN` /
`PROD_WEB_DOMAIN` rather than reaching cross-stack into `WebsiteHosting`.
Same documented tradeoff: this pipeline-stack-scoped step would otherwise
need a real cross-stack reference into the app stack's `Nyc311Stack` (a
different `Stage`/stack in the pipeline's dependency graph) just for a
physical name that's already deterministic (bucket) or effectively
permanent (distribution ID, which only changes if `WebsiteHosting` is ever
destroyed and recreated — an event that would already require hand-editing
`Nyc311PipelineStatusApi.ts`'s two domain constants, so updating this
step's constants alongside them is the same maintenance burden, not a new
one). No `Nyc311Stack.ts` changes are needed for this feature at all.

### 2.4 Interaction with the SPA's error-response rewrite

`WebsiteHosting`'s CloudFront distribution rewrites 403/404 on *any* path
to `/index.html` (React Router deep-link support). Once real objects exist
under `/coverage/`, normal requests resolve directly (200) without
triggering that rewrite; only a genuinely missing coverage asset would
fall back to the SPA shell — the same harmless behavior any other missing
site asset already gets today. Not a blocker, just documented here so it
isn't mistaken for a bug later.

---

## 3. New script: `scripts/publish-coverage.js` — one merged report, not three linked ones

**Revised 2026-08-23, mid-rollout** (before the changes below, the first
cut of this feature staged each package's `coverage/` into
`coverage-publish/<pkg>/` and wrote a summary-table landing page linking
out to each — three separate report silos. The user explicitly wants one
unified report instead: "host the entire collection test coverage at
this endpoint," confirmed via a follow-up question as "one merged,
unified report... no per-package landing page, no separate silos.")

- **Merges Istanbul coverage maps, doesn't just copy files.** Each
  package's `coverage/coverage-final.json` (the raw per-file coverage
  data Vitest's v8 provider writes, in Istanbul's coverage-map format) is
  loaded and combined into one map via `istanbul-lib-coverage`'s
  `createCoverageMap().merge(...)`, then rendered as a single HTML report
  tree via `istanbul-lib-report` + `istanbul-reports`' `"html"` reporter —
  the same libraries Vitest's own `coverage-v8` provider uses internally
  to generate each package's local `coverage/` report, just pointed at a
  map with all three packages' files in it instead of one package's.
- **`defaultSummarizer: "nested"`** on the report context strips the
  common ancestor path across every merged file (the Synth container's
  checkout root, e.g. `/codebuild/output/srcNNNN/src/`) and rebuilds a
  real directory tree from what's left — `backend/`, `cdk/`, `web-app/`
  each a real top-level node with their own file tree underneath, all
  reachable from one `coverage-publish/index.html`. No per-package landing
  table, no separate silos.
- **Custom `sourceFinder`, because the source-file paths don't exist in
  this container.** `coverage-final.json`'s recorded paths are absolute,
  rooted at Synth's CodeBuild container's checkout path — a *different*
  container from this post-deploy step's, so those exact paths are gone
  by the time this script runs. Every recorded path still contains one of
  `backend/`, `cdk/`, or `web-app/` as a path segment, though, so
  `sourceFinder` locates that marker and resolves everything after it
  against *this* container's own `REPO_ROOT` (available here because this
  step's `input` is the full repo checkout, needed for `scripts/` too) —
  verified locally by simulating a stale, unrelated absolute path and
  confirming it still resolves to the real file.
- Requires the `istanbul-lib-coverage`/`istanbul-lib-report`/
  `istanbul-reports` packages, which don't exist at the repo root by
  default (`web-app/`, `backend/`, `cdk/` each pull them in transitively
  via `@vitest/coverage-v8`, but that doesn't help a root-level script) —
  added as `devDependencies` on the repo-root `package.json` (previously
  dependency-free) with a committed `package-lock.json`, installed via
  `npm ci` as this step's first command (§2.2).
- Not part of `backend/`, `cdk/`, or `web-app/` — root-level repo tooling
  (same bucket as `rollup-coverage.js`), so CLAUDE.md §2's 90%-per-file
  coverage gate doesn't apply to it. Sanity checked by hand end-to-end
  before ever running for real in CodeBuild: generated real coverage in
  all three packages, ran `node scripts/publish-coverage.js` from repo
  root, confirmed the resulting tree (`backend/`, `cdk/`,
  `web-app/src/` subtrees), confirmed a per-file page renders real
  annotated source (not a "source lookup failed" error), and confirmed
  the merged top-level percentages reflect all three packages combined.
- `scripts/rollup-coverage.js` (the pre-existing **local** dev
  convenience, `npm run coverage:rollup` at repo root) is unchanged — it
  still produces `build/coverage/index.html`, a landing page linking to
  each package's own local report. That behavior is documented and
  useful for local dev (CLAUDE.md §8); only the CI-*hosted* report changed
  to the merged form the user actually asked for.
- `coverage-publish/` added to the root `.gitignore` alongside `coverage/`,
  `build/`, `cdk.out/` — a local run of the script must not get committed.

---

## 4. `web-app/` changes

- **`MonitoringTile.tsx`**: add an optional `external?: boolean` prop.
  When `true`, render `<a href={to} target="_blank"
  rel="noopener noreferrer">` instead of React Router's `<Link>` — same
  glow/badge/icon presentation, only the anchor swaps. Add `"rose"` as a
  5th `MonitoringTileAccent` (the 4 existing accents are already claimed
  by the 4 existing tiles) with its literal Tailwind classes in
  `ACCENT_STYLES`, per that file's existing static-scanner constraint.
- **`MonitoringPage.tsx`**: add a `CoverageIcon` and a 5th tile:
  `{ title: "Test Coverage", description: "Vitest coverage reports for
  backend, web-app, and cdk.", to: "/coverage/index.html", accent: "rose",
  icon: <CoverageIcon />, external: true }`. `to` is a same-origin relative
  path — it resolves against whichever CloudFront domain is currently
  serving the SPA (Test or Prod), so no environment-specific config is
  needed on the frontend at all.
- No new route, hook, service, or model. The "plain link-out tile"
  decision means the destination is fully static, so there's no data to
  fetch — the tile is presentational only, same shape as the other four
  minus the internal `Link`.
- **Known limitation, not a regression**: in local `vite dev` (mock mode),
  `/coverage/index.html` doesn't exist — clicking the tile 404s locally.
  This matches the existing Lambda Health tile's relationship to its real
  deployed API; noted here rather than "fixed," since faking it would mean
  bundling a fake coverage report into `test-data/`, out of proportion to
  the feature.

---

## 5. Testing plan (CLAUDE.md §2's Operational Loop, per affected package)

- **`web-app/`**: extend `tests/components/MonitoringTile.test.tsx` to
  cover the `external` branch (renders an `<a>` with `target="_blank"`,
  not a router `<Link>`); extend
  `tests/components/pages/MonitoringPage.test.tsx` to assert the 5th tile
  renders with the right `href`/`target`. Then
  `npm run build && npm run lint && npm run test:coverage`.
- **`cdk/`**: new `cdk/tests/pipeline/Nyc311CoveragePublishStep.test.ts` —
  assert the generated CodeBuild project's buildspec contains the sync +
  invalidate commands for the right bucket/distribution, and that its IAM
  role policy is scoped to those exact ARNs (regression guard against an
  accidental blanket `s3:*`/`*` grant). Extend
  `cdk/tests/pipeline/Nyc311PipelineStack.test.ts` with an assertion that
  `DeployTest` and `DeployProd` each carry a `PublishCoverage*` post-deploy
  action. Then `npm run build && npm run lint && npm run test:coverage`.
- **`backend/`**: untouched by this change — run its existing suite once
  as a sanity check, not because this change adds coverage obligations
  there.
- Per-package 90%-per-file gate applies to every new/changed file in
  `web-app/` and `cdk/` per `testing-framework.md` §2 — no exception.

---

## 6. Rollout

1. Implement §2–§4, verify build/lint/test/coverage locally for `cdk/` and
   `web-app/` (per §5).
2. Single commit + push to `main` (CLAUDE.md §7 format).
3. Watch `Nyc311Pipeline`: `Synth` → `UpdatePipeline` (self-mutation picks
   up the new stage steps) → `DeployTest` (app deploy, then
   `PublishCoverageTest`) → `DeployProd` (app deploy, then
   `PublishCoverageProd`).
4. Verify for real, both environments:
   - `aws s3 ls s3://nyc311-web-test/coverage/ --profile nyc311` (and
     `-prod`) — objects present.
   - `curl -sI https://d3u5wagmbm10bm.cloudfront.net/coverage/index.html`
     (and the Prod domain) — `200`, not the SPA shell.
   - Click the new Monitoring page tile in a real browser (both
     environments) and confirm it lands on a real, per-file-drillable
     coverage report.
5. Mark `99-things-to-come-back-to.md`'s "Publishing code coverage" entry
   resolved, pointing at this doc, instead of deleting the entry outright.
