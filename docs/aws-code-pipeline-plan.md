# AWS CodePipeline Plan

Builds a self-mutating, full-CD AWS CodePipeline for NYC 311, per
`claude-prompt-initial.md` §8 and `testing-framework.md` §7.

Starting state this plan builds from: `Nyc311-Test` and `Nyc311-Prod` are
already deployed as empty skeleton stacks (`cdk/stack/Nyc311Stack.ts`,
tagged `Environment: TEST` / `PROD`, no application resources yet), and
the AWS account (`178280182163`, `us-east-1`) is CDK-bootstrapped. GitHub
(`github.com/seththeeke/nyc-311`) is the permanent source repo host.
`CLAUDE.md` §5.3 has been amended with a standing exception permitting the
pipeline its own CloudFormation stack (§2).

No manual approval gate exists anywhere in this pipeline. Human
intervention happens only when the pipeline fails — not as a routine step
in every release. Prod safety is enforced by removing local deploy
capability entirely (§7), not by a human approving each release.

---

## 1. Self-mutating pipeline

AWS CDK Pipelines (`aws-cdk-lib/pipelines`) builds and runs this pipeline
— not a hand-rolled `CodePipeline` with individually wired `CodeBuild`/
`CodeDeploy` actions. After the one-time bootstrap deploy (§6), the
pipeline maintains itself: a change to `cdk/pipeline/*.ts` pushed to
`main` is picked up and applied by the pipeline's own execution, with no
human running `cdk deploy` for it again.

### 1.1 Self-mutation ordering, and preventing stale steps from running after it

Self-mutation compares the newly synthesized pipeline definition against
what's currently deployed, so it runs immediately after the Synth
(Build/Test) step — the earliest point possible, since it needs Synth's
own output to compare against. No deploy stage and no test stage runs
ahead of it. Pipeline order: **Source → Synth
(lint/test/coverage/`cdk synth`) → Self-Mutate → Deploy `test` → Deploy
`prod`.**

`selfMutation: true` is set explicitly on the `CodePipeline` construct.
Two mechanisms prevent a stale (pre-mutation) step from running after a
self-mutation:

- When the Self-Mutate step's `UpdatePipeline` action changes
  `Nyc311PipelineStack`'s CloudFormation template, CodePipeline reads each
  stage's action list from the live pipeline definition when that stage
  starts, not from a definition cached at the start of the execution — so
  every stage after Self-Mutate in the same execution already reflects the
  new structure.
- The pipeline is created as a **CodePipeline V2 pipeline**
  (`pipelineType: PipelineType.V2`, set explicitly). Its execution mode is
  `SUPERSEDED` — the underlying `codepipeline.Pipeline` L2's default when
  `executionMode` isn't overridden, confirmed against the `aws-cdk-lib`
  type definitions rather than assumed, and CDK Pipelines' `CodePipeline`
  construct doesn't override it. `SUPERSEDED` stops an in-progress
  execution at its next stage boundary if a newer execution has
  superseded it.
- The first time a real change lands in `cdk/pipeline/*.ts` after this
  pipeline exists, that execution is treated as a smoke test: the
  CodePipeline console run is checked to confirm the Deploy stages picked
  up the new structure.

---

## 2. Stack topology

The pipeline is its own CloudFormation stack — `Nyc311PipelineStack` —
separate from `Nyc311Stack`. `CLAUDE.md` §5.3 carries a standing
exception for it: the CI/CD pipeline is tooling, not application
infrastructure, and this is the only exception to the single-stack rule.

`Nyc311Stack` (Test and Prod instances) remains the single application
stack shape, deployed by the pipeline as `Stage` wrappers — `Stage` is a
lightweight CDK grouping construct, not a CloudFormation stack, so it adds
no stacks beyond what's below.

Net result in CloudFormation: **3 stacks total** — `Nyc311PipelineStack`,
`Nyc311-Test`, `Nyc311-Prod` — up from the 2 deployed by hand today.

The pipeline's `Stage` wrappers instantiate `Nyc311Stack` under the same
stack names (`Nyc311-Test`, `Nyc311-Prod`) already deployed by hand, so
the first pipeline-driven deploy is a CloudFormation *update* to the
existing stacks, not a create. Nothing gets torn down.

---

## 3. Source & trigger

- **Source: GitHub, via a CodeConnections connection**
  (`arn:aws:codeconnections:us-east-1:178280182163:connection/48eddf51-8724-497c-8ff1-c4507a78e793`,
  named `nyc-311-github-repo`). The connection's entire lifecycle —
  creation and GitHub App repository authorization — is managed outside
  CDK, by hand, once; `Nyc311PipelineStack` references it by ARN as a
  constant rather than creating its own `CfnConnection` resource. §6
  covers why: a CDK-owned connection and its GitHub App installation can
  end up out of sync in a way that's easier to fix by pointing at a
  known-good, manually-authorized connection than by fighting the console
  flow back into updating the original one.
- **Trigger: push to `main`.** Trunk-based — no long-lived
  per-environment branches. Environment promotion happens through the
  pipeline's stage sequence (Test, then Prod), not through separate git
  branches.

---

## 4. Pipeline shape & stages

Maps `testing-framework.md` §7's stage table onto CDK Pipelines
constructs, without a manual-approval action. Fail-fast throughout — each
step only runs if the previous one passed, and a failure anywhere stops
the pipeline and triggers the notification in the last row.

| Stage | CDK Pipelines construct | What runs | Gates |
|---|---|---|---|
| Source | `CodePipelineSource.connection(...)` | Pulls `main` on push | N/A |
| Synth (Build/Test) | `ShellStep` (the pipeline's required synth step) | 1. `cd backend && npm ci && npm run lint && npm run test:coverage` → 2. `cd cdk && npm ci && npm run lint && npm run test:coverage && npm run build` → 3. `cdk synth` (bundles Lambda code from `backend/controller/**` via `NodejsFunction`'s esbuild step automatically, per `CLAUDE.md` §5.2) | Unit + CDK coverage ≥90% per-file (`testing-framework.md` §2/§3) — a failed `npm run test:coverage` fails the step, which fails the pipeline |
| Self-mutate | Built into CDK Pipelines (`selfMutation: true`) — see §1.1 | Diffs the pipeline's own definition against `Nyc311PipelineStack`, redeploys if changed, before any deploy stage runs | A failed self-mutate fails the pipeline |
| Deploy to `test` | `pipeline.addStage(new Nyc311AppStage(..., { envName: 'TEST' }))` | `cdk deploy Nyc311-Test` equivalent | N/A — deploy succeeds or fails |
| Integration tests against `test` | `CodeBuildStep` as a `post` step on the Test stage — added once real integration coverage exists (§5) | Real-integration suite (`testing-framework.md` §4) against the live `test` environment | Endpoint coverage ≥90%; Step Functions path coverage reported only (`testing-framework.md` §5) |
| `cdk diff` visibility (non-blocking) | `ShellStep` (`pre` on the Prod stage) | `cdk diff Nyc311-Prod`, written to the step's logs | Informational only — never blocks the pipeline |
| Deploy to `prod` | `pipeline.addStage(new Nyc311AppStage(..., { envName: 'PROD' }))` | `cdk deploy Nyc311-Prod` equivalent | N/A |
| Failure notification | `pipeline.notifyOn(...)` → SNS → email | Fires on any stage `FAILED` state | This is the human-intervention trigger — see §6/§7 |

Not included yet, added per §5: the SAM CLI / Step Functions Local "local
sanity" tier (`testing-framework.md` §4/§7) and `web-app/` build+test —
neither has real infrastructure to sanity-check yet. When added, both are
automated pass/fail gates, not manual approvals.

### 4.1 Failure notifications

An SNS topic subscribed by email (`seththeeke@gmail.com`) receives a
notification on any pipeline stage failure, via `pipeline.notifyOn(...)`.
This is the sole mechanism that pulls a human into an otherwise fully
automated release.

---

## 5. Day-one scope

The pipeline ships now, minimal, and grows with the codebase rather than
waiting until every tier in `testing-framework.md` §4 has something real
to test.

**Built now:**
- Source → Synth (lint + unit test + coverage for `backend/` and `cdk/`,
  `cdk synth`) → self-mutate → Deploy `test` → `cdk diff` (visibility
  only) → Deploy `prod` → failure notification. Full CD from the first
  push — no manual approval stage exists anywhere in this plan.
- No integration-test stage (no meaningful integration surface deployed
  yet), no SAM CLI/Step Functions Local stage (no Step Functions state
  machine exists yet), no `web-app/` build step (no code there yet).

**Added later, each as a follow-up change to the same self-mutating
pipeline — no new manual bootstrap needed:**
- SAM CLI + Step Functions Local sanity stage, once the Order Workflow
  state machine (`claude-prompt-initial.md` §10 build order item 2)
  exists. Runs in its own, separately-permissioned CodeBuild project
  (needs `privileged: true` for Docker-in-Docker) rather than sharing
  broader build credentials with the deploy-capable project.
- Real-integration test stage against `test`, once there's a meaningful
  API surface to hit.
- `web-app/` lint/build/test step in Synth, once `web-app/` has code.

---

## 6. One-time manual steps

Two categories of manual step exist — connection setup (done, see below
for what actually happened) and the pipeline's own bootstrap deploy.
Neither is an AWS API gap CDK could paper over: no API completes an
OAuth/App-install handshake headlessly, and nothing exists yet to trigger
the pipeline the very first time.

1. **Authorize a GitHub connection, entirely by hand, outside CDK.**
   Originally this plan had CDK create an `AWS::CodeStarConnections::Connection`
   resource (`PENDING` status) for a human to authorize in the console.
   In practice, fixing the GitHub App's repository access for that
   CDK-created connection funneled the console flow into creating a
   *second*, separate connection (`nyc-311-github-repo`, under the
   renamed `codeconnections` ARN namespace) rather than updating the
   first one's installation. Rather than fight that flow, the plan
   changed (§3): CDK no longer creates the connection at all. The
   connection is created and authorized entirely by hand — via
   `github.com/settings/installations` → "AWS Connector for GitHub" →
   Configure → repository access — and `Nyc311PipelineStack` references
   the resulting ARN as a constant. One connection exists going forward;
   the original CDK-created one was removed by the same deploy that
   dropped it from the stack's definition.
2. **Deploy `Nyc311PipelineStack` once, from a local machine, under the
   Deploy Safety Gate.** `cdk deploy Nyc311PipelineStack --profile
   nyc311` (via `bin/pipeline.ts` — see §8 for why that specific entrypoint
   matters), confirmed the same way today's `Nyc311-Test`/`Nyc311-Prod`
   deploys were. Unlike the original plan, this is *not* the last direct
   deploy the `nyc311` profile can run against this specific stack — §7
   permanently exempts `Nyc311PipelineStack` from the deploy lockdown, as
   the recovery path for bugs a self-mutating pipeline can't fix in
   itself. It remains the last direct deploy against `Nyc311-Test`/
   `Nyc311-Prod`, which stay pipeline-only.

No approval click exists anywhere in the day-one pipeline. Once the
pipeline is healthy, pushing to `main` drives everything through Test and
straight to Prod automatically. The only thing that pulls a human in
afterward is the failure notification (§4.1) — confirm the SNS email
subscription (`seththeeke@gmail.com`) via the link AWS sends on first
setup, or notifications won't actually deliver.

---

## 7. Deploy access control after the pipeline is live

Once `Nyc311PipelineStack` is deployed (§6, item 2), the `nyc311` IAM
principal (`arn:aws:iam::178280182163:user/seththeeke-cli` — the identity
behind every `--profile nyc311` command, Claude-run or otherwise) loses
the ability to deploy `Nyc311-Test` and `Nyc311-Prod` directly. From that
point on, the only path that can mutate those two stacks is the
pipeline's own CodeBuild/CodePipeline service roles.

**`Nyc311PipelineStack` itself is deliberately exempt from this
restriction** — a permanent design choice, not a gap. A self-mutating
pipeline cannot fix a bug in its own Synth step: Self-Mutate only runs
*after* Synth succeeds, so a bug that makes Synth fail (or, as happened
in practice, makes it succeed while producing the wrong CDK cloud
assembly) can never be corrected by the pipeline correcting itself — the
fix has to be deployed directly. `nyc311` keeps that direct path open for
`Nyc311PipelineStack` specifically, as the recovery mechanism, while
`Nyc311-Test`/`Nyc311-Prod` have no such bootstrap problem (the pipeline
can always redeploy them once it's healthy again) and stay fully
pipeline-only.

**Mechanism — two IAM statements, both `Deny`, both scoped to the
`nyc311` principal only:**

1. **`DenyAssumeCdkDeployRoles`** — denies `sts:AssumeRole` on the CDK
   bootstrap's deploy-time roles (`cdk-hnb659fds-deploy-role-*`,
   `cdk-hnb659fds-cfn-exec-role-*`), which is what `cdk deploy`/`destroy`
   assume to mutate CloudFormation. The `lookup-role` is left untouched,
   so `cdk synth`/`cdk diff` keep working locally for inspection.
2. **`DenyDirectCloudFormationMutation`** — denies the actual
   `cloudformation:CreateStack`/`UpdateStack`/`DeleteStack`/
   `CreateChangeSet`/`ExecuteChangeSet`/`DeleteChangeSet` actions, scoped
   to `Nyc311-Test`'s and `Nyc311-Prod`'s stack ARNs specifically (not
   `Nyc311PipelineStack`'s). This statement exists because
   `seththeeke-cli` has `AdministratorAccess` attached directly — when the
   CLI can't assume the deploy role (statement 1), it silently falls back
   to mutating CloudFormation with the ambient credentials instead of
   failing outright. Statement 1 alone was verified *not* to block a
   direct deploy for exactly this reason; statement 2 is what actually
   closes it.

**For `CLAUDE.md` §3 (Deploy Safety Gate):** for `Nyc311-Test`/
`Nyc311-Prod`, the gate is now structurally enforced rather than
procedural — `nyc311` is unable to run a mutating deploy against them at
all, confirmation prompt or not. For `Nyc311PipelineStack` and anything
outside pipeline scope, §3 applies exactly as written, unchanged — a
Claude-run deploy of the pipeline stack still needs explicit confirmation
immediately before every run.

**Break-glass, only relevant for `Nyc311-Test`/`Nyc311-Prod` now** (a
`Nyc311PipelineStack` fix no longer needs it — see above):

1. Temporarily delete the `Nyc311DenyDirectDeploy` inline policy from
   `seththeeke-cli` (`aws iam delete-user-policy`) — IAM has no
   higher-precedence-`Allow` override, so the `Deny` itself must be
   removed.
2. Fix and redeploy `Nyc311PipelineStack` directly (now unblocked, since
   step 1 removed the *old* policy — the deploy will re-add whatever
   policy is currently in the stack's own CDK code).
3. Confirm the fix, then either let a pipeline execution's self-mutation
   restore the policy (if the fix didn't change the policy itself), or
   confirm the redeploy already restored it (if it did).

**Current baseline this restriction layers onto:** `seththeeke-cli` has
`AdministratorAccess` attached directly (no groups, no inline policies),
confirmed via `aws iam list-attached-user-policies`. An explicit `Deny`
overrides this grant for the resources/actions it targets regardless.

---

## 8. Code layout

A new subfolder under `cdk/`, consistent with its existing per-resource
construct pattern (`lambda/`, `data/`, `step-function/`):

```
cdk/
  pipeline/
    Nyc311PipelineStack.ts   # holds the CodePipeline construct
    Nyc311AppStage.ts        # Stage wrapper instantiating Nyc311Stack per env
  bin/
    pipeline.ts              # entrypoint App for the pipeline stack (separate
                              # from bin/app.ts, which stays the read-only
                              # synth/diff entrypoint after §6/§7)
```

`bin/app.ts` (existing) stays as a separate, simpler app defining only
the bare `Nyc311-Test`/`Nyc311-Prod` stacks, for local `synth`/`diff`
convenience. It is not used for deploys after §6/§7's bootstrap for those
two stacks: once `nyc311`'s deploy access to them is revoked, a `cdk
deploy` via `bin/app.ts` fails the same way a pipeline-external deploy
would (`Nyc311PipelineStack` deploys still work directly, per §7).

**`cdk.json`'s default app is `bin/app.ts`, not `bin/pipeline.ts` — this
matters inside the pipeline itself, not just for local commands.** The
Synth step's `cdk synth` and the ProdDiff step's `cdk diff` both pass
`--app "npx ts-node --prefer-ts-exts bin/pipeline.ts"` explicitly, rather
than relying on the default. Omitting it was a real bug hit during setup:
`bin/app.ts` synthesizes cleanly on its own (it's a valid, complete app),
but it only contains the bare `Nyc311Stack` instances — no
`Nyc311PipelineStack`, no `Stage`-wrapped structure. Self-mutation and
the pipeline's own deploy actions need the assembly that `bin/pipeline.ts`
produces specifically; against `bin/app.ts`'s assembly, Self-Mutate failed
with "No stacks match the name(s) Nyc311PipelineStack" even though Synth
itself reported success.

---

## 9. IAM & least privilege

- The CodePipeline/CodeBuild service roles CDK Pipelines generates are
  scoped automatically to what each stage touches (synth role, per-stage
  deploy roles via bootstrap's `CloudFormationExecutionRole`) — no
  hand-authored broad policy for the base pipeline.
- The `privileged: true` CodeBuild environment for SAM CLI/Step Functions
  Local (§5) runs in its own, separately-permissioned CodeBuild project,
  not the deploy-capable one, when it's added.
- The `nyc311` deploy restriction (§7) is an inline IAM policy
  (`Nyc311DenyDirectDeploy`) attached to `seththeeke-cli`, with two `Deny`
  statements:
  - `DenyAssumeCdkDeployRoles` — `sts:AssumeRole` on
    `arn:aws:iam::178280182163:role/cdk-hnb659fds-deploy-role-178280182163-us-east-1`
    and `...cdk-hnb659fds-cfn-exec-role-178280182163-us-east-1`. Left
    untouched: `cdk-hnb659fds-lookup-role-*` (backs `cdk diff`/`synth`),
    `cdk-hnb659fds-file-publishing-role-*` and
    `cdk-hnb659fds-image-publishing-role-*` (asset staging isn't itself a
    mutation).
  - `DenyDirectCloudFormationMutation` — `cloudformation:CreateStack` /
    `UpdateStack` / `DeleteStack` / `CreateChangeSet` / `ExecuteChangeSet`
    / `DeleteChangeSet`, scoped to
    `arn:aws:cloudformation:us-east-1:178280182163:stack/Nyc311-Test/*`
    and `.../Nyc311-Prod/*` only — deliberately **not**
    `Nyc311PipelineStack`'s ARN (§7's exemption). Needed because
    `seththeeke-cli`'s `AdministratorAccess` lets `cdk deploy` fall back
    to mutating CloudFormation directly when it can't assume the deploy
    role; statement 1 alone doesn't stop that fallback.
  - Both statements are part of `Nyc311PipelineStack`'s CDK definition
    from its first deploy, not a separate follow-up step. Because they're
    scoped to the `nyc311` principal, neither affects the pipeline's own
    service-role principal assuming the same bootstrap role ARNs or
    deploying the same stacks — so the one bootstrap deploy in §6 both
    stands up the pipeline and revokes `nyc311`'s direct
    `Nyc311-Test`/`Nyc311-Prod` deploy access, atomically, in the same
    changeset.

---

## 10. Cost

CodePipeline is ~$1/month per active pipeline (V2 pricing, pay-per-
execution beyond that), CodeBuild is pay-per-build-minute on a small
default instance size (cents per run at this project's commit
frequency), CodeStar Connections has no separate charge. Immaterial at
this project's scale.

---

## Progress Checklist

- [x] Scaffold `cdk/pipeline/Nyc311PipelineStack.ts` and `Nyc311AppStage.ts` (§8)
- [x] Add `bin/pipeline.ts` entrypoint, plus `synth:pipeline`/`diff:pipeline`/`deploy:pipeline` npm scripts (§8)
- [x] Implement the Synth `ShellStep` (lint/test/coverage for `backend/` and `cdk/`, then `cdk synth`) (§4)
- [x] Configure `selfMutation: true` and `pipelineType: V2` (§1.1) — `executionMode` confirmed at its `SUPERSEDED` default, not overridden
- [x] Add the `cdk diff` visibility step before the Prod stage (§4)
- [x] Add the SNS topic + email subscription (`seththeeke@gmail.com`) and wire `pipeline.notifyOn(...)` (§4.1)
- [x] Add the `nyc311` deploy-role `Deny` policy to `Nyc311PipelineStack`'s definition (§7/§9)
- [x] CDK assertion tests for `Nyc311PipelineStack` and `Nyc311AppStage`; `pipeline/**/*.ts` added to `vitest.config.ts` coverage `include`
- [x] `npm run build` / `lint` / `test:coverage` passing for the new `cdk/pipeline/` code — 100% per-file, both files (`CLAUDE.md` §2)
- [x] `npm run synth` and `npm run synth:pipeline` both synthesize cleanly; `Nyc311-Test`/`Nyc311-Prod` template stack names confirmed to match the already-deployed stacks
- [x] Authorize a GitHub connection outside CDK (§6, item 1) — ended up as `nyc-311-github-repo` (`codeconnections` ARN), referenced by constant rather than CDK-created (§3)
- [x] Deploy `Nyc311PipelineStack` via `bin/pipeline.ts` (`npm run deploy:pipeline`), under the Deploy Safety Gate (§6, item 2) — several rounds, see fixes below
- [x] Confirm `nyc311` can no longer `cdk deploy` `Nyc311-Test`/`Nyc311-Prod` (AccessDenied on `DeleteChangeSet`, confirmed empirically), while `cdk diff`/`synth` still work — `Nyc311PipelineStack` itself deliberately stays deployable directly (§7)
- [x] Confirm a full pipeline execution succeeds end to end: Source → Synth → Self-Mutate → Deploy `test` → `cdk diff` → Deploy `prod` — confirmed `Succeeded` on all five stages
- [x] Confirm the SNS topic delivers to `seththeeke@gmail.com` — **subscription confirmation is still pending**; click the link in AWS's confirmation email or failure notifications won't arrive
- [ ] Push a change to `cdk/pipeline/*.ts` under normal (non-bootstrap) circumstances and confirm the self-mutation smoke test (§1.1) — the run picks up the new structure, no stale steps. Not yet directly observed: every pipeline-definition change so far was applied via a direct bootstrap-style deploy first, so self-mutation has only been confirmed to run cleanly with *no* pending change, not to actually apply one mid-execution.

### Fixes applied beyond the original plan (real issues hit during setup)

- **CodeStar Notifications service-linked role propagation** — first
  `NotificationRule` creation failed (`ConfigurationException`) because
  `AWSServiceRoleForCodeStarNotifications` didn't exist yet on this fresh
  account; AWS creates it on first attempt but needs up to 15 minutes.
  Resolved by retrying, not a code change.
- **Connection ownership moved from CDK-created to externally-authorized**
  — §3/§6.
- **`nyc311`'s `AdministratorAccess` fallback around the AssumeRole deny**
  — §7/§9's second `Deny` statement.
- **CodeBuild's default Node (18, via `STANDARD_7_0`) too old for Vite
  7/Vitest** — pinned to Node 20 via `codeBuildDefaults.partialBuildSpec`
  (`runtime-versions`).
- **Vitest's default 5s test timeout too tight for CodeBuild's `SMALL`
  compute synthesizing the full pipeline stack** — raised to 20s in
  `vitest.config.ts`, CI-only headroom.
- **Synth/ProdDiff steps synthesizing against `cdk.json`'s default app
  (`bin/app.ts`) instead of `bin/pipeline.ts`** — the actual
  self-mutation blocker; §8 covers it in full. This is also why
  `Nyc311PipelineStack` needed a *permanent* deploy-lockdown exemption
  (§7): a bug in the Synth step can't be fixed by a pipeline that can
  never get past that same Synth step to self-mutate.
