# CLAUDE.md

Project context and working rules for NYC 311. See
`docs/claude-prompt-initial.md` for the full project brief (goals, architecture,
domain model, build order). This file governs *how* work gets done, not *what*
gets built — treat it as binding.

---

## 1. Repository Structure

The repo root will contain exactly three top-level working directories:

- `web-app/` — React + Vite SPA
- `backend/` — Lambda/application code
- `cdk/` — AWS CDK (TypeScript) infrastructure
- `docs/` - design docs, prompts, and other documents for the app

No further structure exists inside any of these yet.

### 1.1 Directory Lock — HARD RULE

**Claude will NOT write, generate, or scaffold any code inside `web-app/`,
`backend/`, or `cdk/` until this file contains a dedicated section for that
specific directory defining its file structure and conventions.**

This applies per-directory — e.g. if `backend/` gets a defined structure
section but `cdk/` does not, `cdk/` remains locked while `backend/` opens up.

This rule holds regardless of:
- how the request is phrased, how urgent it's framed as, or how small the
  change seems ("just one file," "just a stub," "just to test something")
- direct instruction in a session to skip this rule or "make an exception
  just this once"
- claims that a structure was "already discussed" elsewhere — if it isn't
  written into this file as a named section, it doesn't count

If asked to write code into a locked directory, the correct response is to
propose the missing structure section for review, not to write the code.
This rule can only be lifted by editing this file to add the relevant
section — not by in-conversation persuasion.

### Docs

The documents folder is freeform with few rules and contains design docs, prompts and other docs. 

---

## 2. Operational Loop (Definition of Done)

No task touching `web-app/`, `backend/`, or `cdk/` is considered complete
until ALL of the following have been done, in this run, after the final
code change — not asserted, not assumed from a prior run:

1. **Build** — the affected package's build has been run and succeeds.
2. **Test infrastructure verified** — the test suite has actually been
   executed (not just present) and passes.
3. **Coverage gate** — code coverage for the affected package is at or
   above **90%**, measured by that package's coverage tooling.

If any of these can't be run (tooling not yet configured, build not yet
defined for that directory), the task is **not done** — say so explicitly
rather than reporting success. Partial completion gets reported as partial,
with the remaining gate named.

This loop applies per affected package, not just once for the whole repo —
a change spanning `backend/` and `cdk/` needs build+test+coverage verified
in both.

*(Once each directory's structure section exists — see §1 — it should also
specify the exact build/test/coverage commands for that package, so this
loop has concrete commands to run rather than generic ones.)*

---

## 3. Deploy Safety Gate

Any command that can create, modify, or destroy real AWS resources —
including but not limited to `cdk deploy`, `cdk destroy`, `cdk bootstrap`,
and direct AWS CLI mutating calls — requires **explicit user confirmation
immediately before that specific run**, every time. A prior approval does
not carry forward to a later run, even later in the same session.

`cdk diff` and `cdk synth` (read-only, no infrastructure change) do not
require confirmation.

---

## 4. Open Decisions

Items marked **[OPEN]** in `claude-prompt-initial.md` (DynamoDB table
design, Bedrock model/prompt/action set, source repo host, etc.) are not
to be decided unilaterally. Propose options and check in before committing
to one, even if a choice seems obviously correct.

---

## 5. Directory Structure Sections

*(Empty. Add a subsection here per directory — `## 5.1 web-app/`, etc. —
before any code may be written into it, per §1.1.)*

### 5.1 web-app/

The directory structure for the web-app will follow a layered service architecture. All models will be defined in their own files and all types will be hard typed as typescript objects with no use of (any) for typing. There will be a service layer for each major service controller based on entity REST path. The application will be broken into re-usable web components, with a rule of thumb that any web component over 200 lines of code should be refactored into components and will be part of the linter. The frontend will always be capable of running an "in memory" mode which will mock out all service calls into a mock in memory data base which will have both sample data as well as generate data on the fly for any write operations. It will follow the below file structure. 

web-app/
 -> routes - route definitions + one access-guard per visibility tier (public
    dashboard vs. authenticated admin), rather than per-page auth checks
    scattered through components/pages
 -> services
 -> hooks - data-fetching/caching per entity, built on TanStack Query;
    components call hooks, never services, directly
 -> components
  -> pages - for top level page components
 -> models - one file per entity: the TypeScript type plus a matching
    runtime (zod) schema; services parse every response through it
 -> config.ts - environment-specific values (API base URL, mock/live flag)
    resolved from Vite's `import.meta.env` (`.env.test` / `.env.production`);
    no secrets committed
 -> tests - has mirrored structure as the web-app to ensure tests follow the same structure
  -> routes
  -> services
  -> hooks
  -> components
   -> pages
  -> models
 -> test-data - this is baked test data for any "in memory" modes and should be lightweight

**Decisions filled in below (Claude's best guess — flag anything that should
go the other way):**

- **State & data-fetching: TanStack Query**, wrapped in `hooks/`. Several
  entities (Order, Case, Operator) are effectively live/polling data — a
  caching layer with built-in refetch/dedup is worth the dependency; hand-rolled
  `useEffect` fetching would just reinvent it, worse.
- **Routing: React Router.** Config lives in `routes/`; each visibility tier
  gets one guard component rather than ad-hoc checks per page.
- **Styling: Tailwind CSS.** Utility-first, integrates natively with Vite,
  keeps component styles colocated instead of a parallel CSS file per
  component.
- **Runtime validation at the network boundary.** "No `any`" is a
  compile-time guarantee only — it says nothing about what a Lambda actually
  returns at 2am. Every `models/` file pairs a TypeScript type with a `zod`
  schema; the service layer parses every response through it before it
  reaches a component, so a malformed API response fails loudly at the
  boundary instead of surfacing as a blank chart three components later.
- **In-memory mode, mechanically.** Each service module exports one
  interface with two implementations — a real `fetch`-based one and an
  in-memory one backed by `test-data/` — selected by the `mock`/`live` flag
  in `config.ts`. Keeping the swap inside the service layer (rather than
  intercepting at the network level) means the same mock implementation is
  directly importable in Vitest/RTL tests too, no separate test-only mocking
  story needed.
- **Accessibility is a baseline, not optional:** semantic HTML, full keyboard
  navigation, `aria-label` on every icon-only control. Enforced via
  `eslint-plugin-jsx-a11y`, not left to code review.
- **Naming:** component files are `PascalCase.tsx` matching their exported
  component name, one component per file; hooks/services/utilities are
  `camelCase.ts`.
- **Linting: ESLint**, with `typescript-eslint`, `eslint-plugin-react-hooks`,
  and `eslint-plugin-jsx-a11y`. The 200-line component rule above is enforced
  via ESLint's `max-lines` rule on `components/**`, not left to review.

---

### Building and Testing the web-app

Per `testing-framework.md` §1/§2/§6: **Vitest** + `@vitest/coverage-v8`,
**React Testing Library** for component tests, **90% coverage gate, per
file** (lines/functions/branches/statements) — no exception for `web-app`.

| Command | Purpose |
|---|---|
| `npm run build` | `tsc -b && vite build` — typecheck, then production bundle |
| `npm run dev` | `vite` — local dev server; `mock`/`live` mode toggled via `.env.local` |
| `npm run lint` | `eslint .` |
| `npm run test` | `vitest run` |
| `npm run test:coverage` | `vitest run --coverage` — fails if any file is under 90% (`testing-framework.md` §2) |

These are the concrete commands CLAUDE.md §2's Operational Loop runs against
this package once code exists here.

---

### 5.2 backend/

The backend will follow a basic controller, service, and data access object(DAO) paradigm for any logical endpoints. The service layer will be re-usable across both the sync and async components of the application. Any input to the backend service will come through a controller, whether async or not. For example, if the API gateway is connected to a Lambda function, it will have a controller endpoint to service the request. If a step function step invokes a Lambda, it will also first enter through a controller endpoint call. Likewise, if EventBridge Scheduler invokes a Lambda directly (e.g. the NYC 311 poller, `1-data-ingestion.md`), that Lambda also enters through a controller endpoint — the same pattern applies regardless of trigger type. Additionally, every controller will parse/validate its raw trigger payload (API Gateway event body, Step Functions input, EventBridge Scheduler input — whichever AWS-defined shape that trigger hands the Lambda; the handler's exported signature stays whatever AWS requires, that part isn't ours to change) into a structured, typed model via a zod schema as the first thing it does, and pass that structured model to the service layer — never passing the raw event further down the call chain. The backend will use Typescript and all modeled will be strictly typed with no use of (any). The directory structure will be.

-> backend
 -> logger.ts - shared structured-JSON logging (console.log/warn/error under
    the hood), used by every layer per the "Logging by layer" rule below
 -> controller
  -> web-api - controller endpoints for the public web api
  -> ingestion - controller endpoints for scheduled external-data ingestion
     (e.g. the NYC 311 poller, `1-data-ingestion.md`) — entry point is an
     EventBridge Scheduler trigger, not API Gateway or Step Functions
  -> order-request-processing - controller endpoints for the order intake processing steps
  -> order-processing - controller endpoints for the main order step function workflow
  -> data-archival - controller endpoints for any callback or fetching information during archival
 -> service
  -> grouped into logical processing services, not necessarily by entity
 -> dao - explicitely grouped by entity we store, names matching
    data-model.md exactly
  -> request
  -> order
  -> case
  -> operator
  -> location
  -> shift
  -> user
 -> models - all shared types live here, one file each (TS type + zod
    schema), consumed by dao/service/controller — same pattern as
    web-app's models/. This includes data-model.md entities (named to
    match it exactly) *and* other shared-but-not-a-domain-entity types
    (e.g. the NYC 311 ingestion cursor, 1-data-ingestion.md §2) — anything
    used across layers belongs in models/, not colocated next to whichever
    DAO happens to use it most. Plus the typed error hierarchy (e.g.
    ValidationError, NotFoundError, TransientError, TerminalError) thrown
    by service/dao and caught by controllers. API Gateway controllers map
    errors to HTTP status codes; Step-Functions-invoked controllers let
    them propagate with a distinguishable `.name` so cdk/'s Catch/Retry
    blocks can route on error type (retry Transient, go straight to
    Case-creation on Terminal, per claude-prompt-initial.md §4.1).
 -> tests - the test file structure will mirror the overall code structure to ensure even coverage throughout and easy navigation.

**Decisions filled in below (Claude's suggestions, reviewed one by one):**

- **Runtime validation at every trust boundary.** "No `any`" is compile-time
  only. Every controller validates its incoming payload (API Gateway body,
  Step Functions input, EventBridge detail) through a `zod` schema before it
  reaches a service; every DAO validates external API responses (e.g. the
  NYC 311 SODA API, proven inconsistent per `1-data-ingestion.md` §4) the
  same way before writing them. A malformed payload fails loudly at the
  boundary, not three calls deep.
- **DAO layer splits along ddb-design.md's two table shapes, not just by
  entity.** Rather than every DAO reimplementing the transactional
  append-and-fold logic independently, `dao/` gets two small shared base
  abstractions: an `EventSourcedDao<TProjection, TEvent>` (append event +
  update projection atomically via TransactWriteItems, condition-checked
  against `last_event_sequence`) that `order/`, `case/`, and `operator/`
  extend, and a plain `Dao<TEntity>` for `location/`, `request/`, `shift/`,
  `user/`. Per-entity folders stay exactly as sketched — this just factors
  out the repeated transactional logic instead of copy-pasting it three
  times.
- **Failure injection reuses the real error path, per claude-prompt-initial.md
  §6.** Order Workflow stage controllers check a chaos-config flag (a
  DynamoDB config item or Parameter Store, per the brief) before delegating
  to their service; if injection is active for that stage, the controller
  throws the configured `models/` error type (TransientError,
  TerminalError, ...) directly, rather than running a separate simulated
  failure path. This guarantees an injected failure exercises the exact
  same retry policy and Case-creation transition as a genuine one.
- **Linting: ESLint** with `typescript-eslint`, matching `web-app` for one
  lint philosophy across the TS monorepo (no React-specific plugins needed
  here). `@typescript-eslint/no-explicit-any` is what actually enforces
  "no `any`" — a lint failure, not a review nitpick.
- **Naming:** all backend files are `camelCase.ts`, one exported
  handler/class/function per file, filename matching the primary export
  (e.g. `getOrders.ts` exports `getOrders`). No components here, so no
  PascalCase split like web-app's.
- **Logging by layer**, via the shared `logger.ts` (structured JSON —
  the same substrate `1-data-ingestion.md` §8's CDK-declared `MetricFilter`s
  extract custom metrics from, so consistent shape matters, not just
  readability):
  - **Logging is pessimistic, not optimistic: when in doubt, log it.**
    Default to more log lines, not fewer. An unlogged branch or step is
    invisible when debugging a production incident after the fact — there's
    no going back to add the log line that would have shown what happened.
    Log volume is cheap; a blind spot during an incident is not. This
    applies at every layer below, including `service/` — favor logging
    every meaningful step/branch over guessing in advance which ones will
    turn out to matter.
  - `controller/` logs the full request and response for every call — the
    one place that captures "what came in, what went out" for a given
    invocation, regardless of trigger type.
  - `service/` logs at every meaningful step for tracing — each branch
    taken, each business decision made, each record/item's outcome when
    processing a batch (not just a final summary count) — per the
    pessimistic-logging rule above.
  - `dao/` logs the inputs to every read/write it performs (table,
    operation, the value(s) given). In practice this mostly lives in the
    shared `Dao` base class's `getItem`/`putItem` (covers every plain DAO
    automatically); a DAO method that bypasses those primitives (e.g. a GSI
    query) logs its own inputs directly.

---

### Building and Testing the backend

Per `testing-framework.md` §1/§2/§4: **Vitest** + `@vitest/coverage-v8`, AWS
SDK calls (DynamoDB, EventBridge, Bedrock, ...) mocked via
`aws-sdk-client-mock`, **90% coverage gate, per file** — no exception for
`backend`.

Lambda bundling happens in `cdk/`, not here: each `controller/**` entry file
is referenced directly by path from an `aws-lambda-nodejs.NodejsFunction`
construct, which bundles it with esbuild at synth/deploy time. `backend/`
never produces its own deployable artifact.

| Command | Purpose |
|---|---|
| `npm run build` | `tsc --noEmit` — typecheck only, no bundle |
| `npm run lint` | `eslint .` |
| `npm run test` | `vitest run` |
| `npm run test:coverage` | `vitest run --coverage` — fails if any file is under 90% |

---

### 5.3 cdk/

There is a single stack for the entire application. We will not create another stack unless explictely specified. We will leverage custom constructs per resource, e.g. we will not instantiate a Lambda function with a new name, but rather create a construct which extends the Lambda construct and then instantiate that custom construct from within the main stack application. 

**Standing exception — the CI/CD pipeline.** The self-mutating AWS
CodePipeline (`aws-code-pipeline-plan.md`) is CI/CD tooling, not
application infrastructure, and is permitted its own CloudFormation stack
(`Nyc311PipelineStack`, under `cdk/pipeline/`), separate from `Nyc311Stack`.
This is the only standing exception to the single-stack rule; any further
exception still requires the explicit-specification bar this rule sets.

-> cdk
 -> bin - the CDK app entrypoint (`app.ts`); instantiates the one stack shape once per environment (`Nyc311-Test`, `Nyc311-Prod`), per the "single stack" rule above — not two different stack classes. The pipeline's own entrypoint (`bin/pipeline.ts`) is separate, per the standing exception above.
 -> stack
 -> pipeline - the self-mutating CodePipeline stack/constructs (`Nyc311PipelineStack`), the standing exception to the single-stack rule above
 -> lambda
 -> data - contains any data related constructs like DDB, Data Lake, etc
 -> step-function - contains the step function construct and its composition, importing lambdas where needed
 -> web - static-site hosting constructs (S3 + CloudFront) for `web-app/`, per `claude-prompt-initial.md` §5/§7's hosting decision
 -> api - the public API Gateway (HTTP API) and its route/integration constructs, per `claude-prompt-initial.md` §5/§7 — first added for `1-data-ingestion.md` §8a's ingestion-metrics endpoint
 -> tests - the test directory will mirror the cdk directory entirely and unit test each construct in isolation

**Per-environment physical resource naming.** `Nyc311-Test` and `Nyc311-Prod`
deploy into the same AWS account/region (`bin/app.ts`), so every *named*
resource (Lambda functions, log groups, queues, topics, alarms, schedules,
tables, ...) must get an explicit, env-suffixed physical name — never left
to CloudFormation's auto-generated default. An unsuffixed name risks an
outright collision between the two stacks (as `ddb-design.md`'s originally
unsuffixed `Requests` table name would have); an auto-generated one avoids
collision but isn't identifiable at a glance in the console/CLI, which
matters just as much operationally — the stack-level `Environment` tag
alone isn't a substitute. Use the shared suffix map exported from
`stack/Nyc311Stack.ts` (`ENV_NAME_SUFFIX: Record<Nyc311Environment, "Test" |
"Prod">`) rather than each construct inventing its own — e.g.
`` `Nyc311Poller-${ENV_NAME_SUFFIX[envName]}` ``. Title-case suffix, not
ALL_CAPS — physical infrastructure names follow their own convention per
§6's carve-out, not the enum-value rule.

---

### Building and Testing the cdk/ app

Per `testing-framework.md` §1/§2/§3: **Vitest** + `@vitest/coverage-v8`
(same runner/provider as `web-app`/`backend`), **CDK assertion tests**
(`aws-cdk-lib/assertions`, fine-grained `template.hasResourceProperties(...)`
— no snapshot testing) run as plain Vitest test files under `tests/`, **90%
coverage gate, per file** — no exception for `cdk`. `bin/*.ts` is excluded
from the coverage gate (app entrypoint, just instantiates stacks, per
`testing-framework.md` §2).

When executing any mutative commands, you must use the profile nyc311

Every `cdk`/`aws` CLI invocation against this project — `synth`/`diff`/`deploy`
and any direct AWS CLI call alike, not just the mutative ones — uses
`--profile nyc311`, wired into the `npm run` scripts below rather than
relied on as an ambient default (`~/.aws/config`'s `[default]`), so the
target account/region is always explicit in the command itself.

| Command | Purpose |
|---|---|
| `npm run build` | `tsc --noEmit` — typecheck only, no bundle (per-Lambda esbuild bundling happens at `cdk synth`/`deploy` time via `NodejsFunction`, not here) |
| `npm run lint` | `eslint .` |
| `npm run test` | `vitest run` |
| `npm run test:coverage` | `vitest run --coverage` — fails if any file is under 90% |
| `npm run synth` | `cdk synth --profile nyc311` — read-only, no Deploy Safety Gate confirmation needed (CLAUDE.md §3) |
| `npm run diff` | `cdk diff --profile nyc311` — read-only, no confirmation needed |
| `npm run deploy` | `cdk deploy --profile nyc311` — **mutates real AWS resources; requires explicit user confirmation immediately before every run, per CLAUDE.md §3** |

## 6. Coding Conventions

Apply across every package (`web-app`, `backend`, `cdk`), not just one
directory's structure section.

- **Enums and constant string values are `ALL_CAPS`.** E.g. a `RequestStatus`
  value is `"DRAFT"`, not `"draft"`. `data-model.md` documents these same
  values in lowercase for readability — the code representation is the
  `ALL_CAPS` form; the two aren't meant to be the same string.
  - Applies to: the *values* a categorical/enum-like field can take (status
    codes, type discriminators, source tags).
  - Does **not** apply to: variable/file naming (each directory's own
    convention governs that), identifier/key strings we construct (e.g. a
    DynamoDB sentinel partition key like `"CURSOR#NYC_311"` — its *embedded*
    enum fragment follows the rule, but the key pattern itself isn't an enum
    value), `Error.name` (follows the platform's own PascalCase convention —
    `ValidationError`, `TerminalError` — so Step Functions `Catch` blocks
    can pattern-match on it as documented in `models/errors.ts`), or
    physical infrastructure names (DynamoDB table/index names) already
    locked in `ddb-design.md`.

## 7. Code Commits

The repo is hosted at https://github.com/seththeeke/nyc-311 and already setup. When you are asked to commit anything, you will commit all outstanding changes as a single commit rather than breaking the work down in any way unless instructed separately, this will prevent the chance of committing chunks that are not feasible piecewise. You will commit changes in the following format.

[<feat> or <bugfi>] - Claude Commit: <Commit message>