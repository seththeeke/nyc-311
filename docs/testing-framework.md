# Testing Framework & Practices

> Negotiated **topic by topic, starting 2026-07-29**, same style as
> `data-model.md` / `ddb-design.md`. Defines the concrete testing
> technology, coverage gates, and pipeline wiring referenced (but not yet
> specified) by CLAUDE.md §2's Operational Loop — once each of `web-app/`,
> `backend/`, `cdk/` gets its own directory-structure section (CLAUDE.md
> §5), this doc is what supplies the exact build/test/coverage commands
> that loop calls for.
>
> Written with an explicit secondary goal in mind: this project's
> build/test/coverage loop is meant to be drivable by an **agentic loop**
> (build → test → measure → add tests → repeat until the exit condition is
> met), so every gate defined here is deliberately something with a
> scriptable, machine-parseable pass/fail signal — not just a human-read
> report.

---

## Decision Status

| Topic | Status |
|---|---|
| [1. Test runner](#1-test-runner) | **Agreed** |
| [2. Coverage tooling & the 90% gate](#2-coverage-tooling--the-90-gate) | **Agreed** |
| [3. CDK assertion testing](#3-cdk-assertion-testing) | **Agreed** |
| [4. The four-tier testing model](#4-the-four-tier-testing-model) | **Agreed** |
| [5. Coverage per tier](#5-coverage-per-tier) | **Agreed** |
| [6. Frontend testing](#6-frontend-testing) | **Agreed** |
| [7. CodePipeline/CodeBuild wiring](#7-codepipelinecodebuild-wiring) | **Agreed** |

---

## 1. Test runner

**Vitest, for both `web-app` and `backend`** (and, per §3, `cdk` as well —
one runner project-wide). Reasons:

- Everything in this project is TypeScript (CLAUDE.md §7), and `web-app` is
  already Vite-based, so Vitest is the path of least friction there.
- Vitest's API is Jest-compatible (`describe`/`it`/`expect`, the same
  mocking primitives), so there's nothing new to learn moving between
  `web-app` and `backend` test files, despite one runner covering a
  React SPA and the other covering Lambda handlers / Step Functions
  glue code.
- Meaningfully faster than Jest (native ESM, no transform step) —  worth
  weighting given an agentic loop will be re-running the suite repeatedly,
  not just once per human-initiated commit.

Considered and rejected: Jest for `backend` specifically, on the theory
that it's the more common choice in AWS's own sample repos/docs. Rejected
because there's no Lambda-specific testing capability Jest has that Vitest
lacks — a handler is just a TypeScript function, nothing about unit-testing
it is Lambda-runtime-specific (that concern is handled separately, at the
local-sanity tier — see §4).

---

## 2. Coverage tooling & the 90% gate

**Provider: `@vitest/coverage-v8`** (not `@vitest/coverage-istanbul`).
V8's native coverage engine, no code-instrumentation build step, faster —
no meaningful precision loss for this project's code (typical Lambda
handlers and React components, not code with subtle branch-coverage edge
cases that would favor Istanbul's more mature branch analysis).

**Enforcement: per-file thresholds, not a package-wide average.** A
package-average threshold lets one heavily-tested file mask a barely-tested
one; per-file forces every file to individually clear the bar, which
matters specifically because this is meant to drive an agentic loop that
should be made to address every file, not just hit a number in aggregate.

```typescript
// vitest.config.ts — shared shape across web-app, backend, and cdk
coverage: {
  provider: 'v8',
  thresholds: {
    lines: 90,
    functions: 90,
    branches: 90,
    statements: 90,
    perFile: true,
  },
  reporter: ['text', 'html', 'json-summary', 'json'],
  exclude: [
    // Vitest's own sensible defaults (test files, *.d.ts, node_modules,
    // dist, config files) are inherited automatically, not replaced.
    '**/*.types.ts',   // type-only files, no runtime logic to cover
    '**/constants.ts', // static lookup tables / config values
    '**/index.ts',     // barrel re-export files
    'bin/*.ts',         // CDK app entrypoint — just instantiates stacks
  ],
}
```

**Why `json-summary`/`json` reporters specifically:** these produce a
machine-readable `coverage-summary.json` / `coverage-final.json` with
per-file (and with the v8 provider, per-line/per-branch) data. This is what
lets an agentic loop target its *next* iteration precisely — "file X, lines
40–52 uncovered" — rather than re-deriving that from a plain-text report or
guessing.

**Exclude-list governance.** An exclude list is also a loophole — nothing
mechanically stops a future loop iteration from "solving" a stubborn
coverage gap by adding the offending file to `exclude` instead of writing
the test. Policy, not just mechanism, guards against this:

- The exclude list lives in version control; any addition is a visible
  diff in review, never edited invisibly mid-loop.
- Scope stays limited to genuinely logic-free categories (types, constants,
  generated code, barrel exports) — never a handler, Lambda, Step Function
  definition, or anything containing a real conditional/branch.
- Starting list above is deliberately minimal and expected to evolve as
  real files show up that warrant it — not meant to be exhaustively
  predicted upfront.

---

## 3. CDK assertion testing

Uses `aws-cdk-lib/assertions` (bundled with `aws-cdk-lib`, already a
project dependency — **no new tooling required**). You synthesize a stack
in-memory (`Template.fromStack(stack)`) and assert on the resulting
CloudFormation JSON, as a plain TypeScript test file — meaning it runs
under the exact same Vitest + v8 coverage setup as everything else, with
no separate provider or pipeline stage type needed.

**Fine-grained assertions only** (`template.hasResourceProperties(...)`,
`template.resourceCountIs(...)`, etc.) — **no snapshot testing.** Snapshot
testing (`Template.toJSON()` diffed against a stored file) was considered
and explicitly declined: every intentional change requires a snapshot
update, and both a human reviewer and an agentic loop can rubber-stamp a
snapshot update without really looking at it, which defeats the point.
Fine-grained assertions document *why* each invariant exists (PITR is on,
`RemovalPolicy` is `RETAIN`, a specific GSI has the right key schema) and
stay resilient to unrelated changes elsewhere in the stack.

**Coverage note specific to this tier:** CDK stack code is mostly linear
construct instantiation, so writing fine-grained assertions tends to yield
high coverage as a side effect of writing them, not extra work — the
exception is any real branching (e.g. an environment-conditional like
`RemovalPolicy: env === 'prod' ? RETAIN : DESTROY`, once `cdk/` reaches
that point), which needs one test per branch to actually hit each path.

Assumed (not yet explicitly re-confirmed): the `cdk/` package inherits the
same 90% per-file gate as `web-app`/`backend` from §2 — no CDK-specific
exception has been raised, so the general rule applies unless told
otherwise.

---

## 4. The four-tier testing model

The core question underneath "local testing," "stubs," and "integration
test infrastructure" turned out to be one architectural choice: how do you
emulate AWS services before deploying anything real? Three tool families
exist — AWS SAM CLI (single-Lambda local invocation via Docker), Step
Functions Local (a Docker image that runs real ASL state machines
locally), and LocalStack (a single container emulating many AWS services
at once, for cross-service wiring tests).

**Decision: no standalone LocalStack tier.** The deciding factor —
**LocalStack's free tier doesn't support Bedrock or Managed Agents for
Bedrock**, which is the most novel part of this architecture
(`capacity-model.md` §7.3's two isolated agent personas). Since no local
tool can faithfully emulate that piece regardless, a real deployed `test`
environment is unavoidable as an integration tier anyway — adding
LocalStack as a *fourth* tier on top would mostly duplicate what that real
tier already does, for a project at this scale. Named tradeoff: fewer
tiers, but the deployed-`test`-environment tier carries more weight, and
iterating against it is slower (real deploy latency) than a local
container would be.

| Tier | Tool | What it catches |
|---|---|---|
| Unit | Vitest (§1) | Logic correctness, in isolation. AWS SDK calls (Bedrock, DynamoDB, EventBridge, ...) mocked via `aws-sdk-client-mock`. |
| CDK assertions | `aws-cdk-lib/assertions` (§3) | Infra config correctness. |
| Local sanity | SAM CLI (`sam local invoke`) + Step Functions Local | "Does this actually run in a real Lambda runtime / real ASL engine" — catches runtime-shape bugs unit tests structurally can't (bad env var wiring, cold-start issues, malformed ASL). |
| Real integration | Tests run against the actual deployed `test` AWS environment (`claude-prompt-initial.md` §8 pipeline shape) | The only tier that exercises real Bedrock, real IAM boundaries, real DynamoDB Streams → Firehose wiring. |

SAM CLI works against a CDK-synthesized template directly
(`sam local invoke -t cdk.out/Stack.template.json`) — no SAM-authored
template format needed despite this being a CDK project.

---

## 5. Coverage per tier

Each tier's relationship to "coverage" is different, and forcing all four
into one number would be dishonest about what's actually being measured:

| Tier | Coverage mechanism | Threshold | Gate relationship |
|---|---|---|---|
| Unit + CDK assertions | `@vitest/coverage-v8` (§2) | **90%, per file** | **This is the source-of-truth gate for CLAUDE.md §2.** |
| Local sanity (SAM CLI) | `NODE_V8_COVERAGE=<dir>` env var on the SAM CLI Lambda container, then `c8 report` (same V8 coverage engine as `@vitest/coverage-v8` — genuinely real line/branch coverage, not a proxy) | **60%**, aggregate across the tier (not per-file — see note) | **Separate gate.** Does *not* merge into the 90% unit gate — blending would let a broad local invocation "phone in" coverage that should come from a targeted unit test, undermining per-file enforcement. |
| Real integration — endpoint coverage | % of API Gateway routes (known statically from the CDK synth output) hit at least once by the integration suite | **90%** | **Separate gate.** |
| Real integration — Step Functions path coverage | % of state-machine states/transitions (including `Catch`/`Retry` error paths) exercised, derived by calling `GetExecutionHistory` on every integration-test-triggered execution and diffing entered states against the full state list in the ASL definition | *(none)* | **Reported only, not gating.** Lower priority than endpoint coverage, kept in scope specifically as a learning exercise (first time implementing this pattern) rather than because the project needs it yet. |

Considered and dropped: **event-type coverage** (% of the domain's
event-sourced `event_type` enum values — `OrderCreated`, `StageFailed`,
`CaseCreated`, etc. per `data-model.md` — emitted at least once by the
integration suite). Would have been the most architecture-specific of the
three proxy metrics, but judged not worth the added scope alongside
endpoint + path coverage.

**Why real deployed-Lambda coverage was rejected as a concept entirely**
(not even considered for the real-integration tier): true code coverage
from a real deployed Lambda means shipping instrumentation into the actual
deployed artifact and finding somewhere to flush the coverage data from
(CloudWatch Logs, S3, etc.) — test-only code living inside what's meant to
become production Lambda code, adding latency to every invocation, for
little benefit at this project's scale. The two structural proxies
(endpoint coverage, path coverage) get most of the same signal without
that risk.

**Per-file vs. aggregate for the SAM CLI tier (60%):** aggregate, not
per-file, by design — this tier is meant as a lighter-weight secondary
diagnostic ("does this run end-to-end"), not a second per-file gate
duplicating what the unit tier already enforces at 90%. Not yet explicitly
confirmed with the project owner; flagged here as an assumption rather than
asked as its own question, consistent with "evolve as needed."

---

## 6. Frontend testing

**Component-level testing: Vitest (§1) + React Testing Library.** The
de facto standard pairing for React under Vitest — RTL queries the DOM the
way a user would (by role/label/text, not internal component state), which
tests components as black boxes and holds up better as the UI evolves than
implementation-detail-coupled tests would. Falls under the same 90%
per-file coverage gate as `backend`/`cdk` (§2) — no exception for
`web-app`.

**No end-to-end (browser-driving) testing for now.** Considered
(Playwright, against either a local dev server + the four-tier backend, or
the deployed `test` environment — same "which environment" question as
backend integration tests in §4), and explicitly deferred rather than
adopted: component-level RTL coverage is judged sufficient at this stage,
with E2E left as a plausible future addition once there's an actual
deployed UI worth pointing a browser-automation suite at.

---

## 7. CodePipeline/CodeBuild wiring

Maps the tiers from §4/§5 onto the pipeline shape already sketched in
`claude-prompt-initial.md` §8 (`Source → Build/Test (CodeBuild) → Deploy
test → Automated integration tests against test → Manual approval → Deploy
prod`, with CodeBuild running lint/unit tests/CDK synth/CDK assertion
tests):

| Pipeline stage | What runs (in order — **fail-fast**, stop at first failure) | Gates (block progression) |
|---|---|---|
| **Build/Test** (CodeBuild, pre-deploy) | 1. Lint → 2. Unit tests (`web-app`, `backend`, `cdk`) → 3. CDK synth → 4. CDK assertion tests → 5. SAM CLI local sanity + Step Functions Local | Unit + CDK coverage ≥90% per-file (§2/§3); **SAM CLI coverage ≥60% (§5) — a failure here fails the pipeline**, same as any other gate in this stage, despite being a lighter-weight diagnostic in intent. |
| **Deploy to `test`** | `cdk deploy` against the `test` stack | N/A — deploy succeeds or fails |
| **Integration tests against `test`** | Real-integration suite (§4) against the live `test` environment | Endpoint coverage ≥90% (§5); Step Functions path coverage — reported only, non-blocking (§5) |
| **Manual approval** | `cdk diff` surfaced for review before prod | Human judgment, not automated |
| **Deploy to `prod`** | `cdk deploy` against the `prod` stack | N/A |

**Fail-fast within Build/Test** — each step only runs if the previous one
passed, rather than collecting all failures before reporting. Chosen for
build-time efficiency (don't spend CodeBuild minutes running Docker-based
SAM/Step-Functions-Local sanity checks if unit tests already failed) over
the "see everything that's wrong in one pass" alternative.

**Infrastructure requirement:** SAM CLI local invocation and Step Functions
Local both run as Docker containers, so the CodeBuild project running step
5 needs `privileged: true` (Docker-in-Docker). Flagged as a real
security-posture tradeoff, not a checkbox — a privileged CodeBuild
environment is a broader attack surface than a standard one.

---

## Still Open

- **Aggregate vs. per-file for the SAM CLI 60% threshold** — stated as an
  assumption in §5, not yet explicitly confirmed.
- **`cdk/` inheriting the general 90% per-file gate** — stated as an
  assumption in §3, not yet explicitly re-confirmed for this specific
  package.
- **Privileged CodeBuild environment for the SAM CLI/Step Functions Local
  step** — a real security-posture tradeoff (§7), not yet weighed against
  alternatives (e.g. scoping that step to its own more narrowly-permissioned
  CodeBuild project rather than sharing broader build credentials with a
  privileged Docker-in-Docker environment).
