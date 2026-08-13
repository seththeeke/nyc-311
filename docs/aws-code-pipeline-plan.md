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

- **Source: GitHub, via a CodeStar Connection.**
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

Two steps in this plan are manual, both strictly one-time — AWS platform
limits (no API completes an OAuth/App-install handshake headlessly, and
nothing exists yet to trigger the pipeline the very first time), not gaps
in the design.

1. **Authorize the GitHub CodeStar Connection, in the AWS Console.**
   `cdk`/CloudFormation creates the
   `AWS::CodeStarConnections::Connection` resource, but it comes up in
   `PENDING` status. In the AWS Console (Developer Tools → Settings →
   Connections), click "Update pending connection" and complete GitHub's
   App-authorization flow, granting access to `seththeeke/nyc-311`. The
   connection stays authorized indefinitely afterward.
2. **Deploy `Nyc311PipelineStack` once, from a local machine, under the
   Deploy Safety Gate.** `cdk deploy Nyc311PipelineStack --profile
   nyc311`, confirmed the same way today's `Nyc311-Test`/`Nyc311-Prod`
   deploys were. This deploy includes the IAM restriction from §7, so it
   is the last deploy the `nyc311` profile ever runs directly. Every
   deploy after this one — pipeline-definition changes and every future
   Test/Prod release — is automatic.

No approval click exists anywhere in the day-one pipeline. Pushing to
`main` after step 2 drives everything through Test and straight to Prod
automatically. The only thing that pulls a human in afterward is the
failure notification (§4.1).

---

## 7. Deploy access control after the pipeline is live

Once `Nyc311PipelineStack` is deployed (§6, item 2), the `nyc311` IAM
principal (`arn:aws:iam::178280182163:user/seththeeke-cli` — the identity
behind every `--profile nyc311` command, Claude-run or otherwise) loses
the ability to deploy. From that point on, the only path that can mutate
`Nyc311-Test`, `Nyc311-Prod`, or `Nyc311PipelineStack` is the pipeline's
own CodeBuild/CodePipeline service roles.

**Mechanism:** an explicit IAM `Deny` on `sts:AssumeRole`, scoped to the
`nyc311` principal, against the CDK bootstrap's deploy-time roles —
`cdk-hnb659fds-deploy-role-*` and `cdk-hnb659fds-cfn-exec-role-*` — which
is what `cdk deploy`/`cdk destroy` assume to mutate CloudFormation. The
`lookup-role` is left untouched, so `cdk synth`/`cdk diff` keep working
locally for inspection; only the mutating path is cut off.

**For `CLAUDE.md` §3 (Deploy Safety Gate):** for `Nyc311Stack`
(Test/Prod) and `Nyc311PipelineStack`, the gate becomes structurally
enforced rather than procedural — the `nyc311` profile is unable to run a
mutating deploy against these stacks at all, confirmation prompt or not.
`CLAUDE.md` §3's text is unchanged and still fully governs the one-time
bootstrap deploy in §6. For anything outside pipeline scope (ad-hoc AWS
CLI calls, resources not yet modeled in `cdk/`), §3 applies exactly as
written — this restriction is scoped to the two deploy roles, not a
blanket IAM lockout.

**Break-glass, if the pipeline is ever broken and can't self-heal:**

1. Temporarily remove the `Deny` statement (or attach a higher-precedence
   `Allow` is not viable — IAM has no such override; the `Deny` statement
   itself must be removed or the affected policy detached).
2. Fix and manually redeploy `Nyc311PipelineStack` via `bin/app.ts` under
   the Deploy Safety Gate, exactly as in §6's original bootstrap deploy.
3. Confirm the pipeline runs a clean execution end to end.
4. Re-apply the `Deny` — either by re-running the pipeline (since the
   restriction is part of `Nyc311PipelineStack`'s own CDK definition, a
   successful self-mutation restores it automatically) or by re-attaching
   it manually if the pipeline itself is what's broken.

**Current baseline this restriction layers onto:** `seththeeke-cli` has
`AdministratorAccess` attached directly (no groups, no inline policies),
confirmed via `aws iam list-attached-user-policies`. An explicit `Deny`
overrides this grant for the two scoped role ARNs regardless.

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

`bin/app.ts` (existing) stays as the local `synth`/`diff` entrypoint for
either stack. It is not used for deploys after §6/§7's bootstrap: once
the `nyc311` profile's deploy-role access is revoked, a `cdk deploy` via
`bin/app.ts` fails the same way a pipeline-external deploy of
`Nyc311PipelineStack` would.

---

## 9. IAM & least privilege

- The CodePipeline/CodeBuild service roles CDK Pipelines generates are
  scoped automatically to what each stage touches (synth role, per-stage
  deploy roles via bootstrap's `CloudFormationExecutionRole`) — no
  hand-authored broad policy for the base pipeline.
- The `privileged: true` CodeBuild environment for SAM CLI/Step Functions
  Local (§5) runs in its own, separately-permissioned CodeBuild project,
  not the deploy-capable one, when it's added.
- The `nyc311` deploy restriction (§7) is an inline or managed IAM policy
  attached to `seththeeke-cli` with an explicit `Deny` on
  `sts:AssumeRole`, scoped by resource ARN to:
  - `arn:aws:iam::178280182163:role/cdk-hnb659fds-deploy-role-178280182163-us-east-1`
  - `arn:aws:iam::178280182163:role/cdk-hnb659fds-cfn-exec-role-178280182163-us-east-1`

  Left untouched: `cdk-hnb659fds-lookup-role-*` (backs `cdk diff`/
  `synth`), `cdk-hnb659fds-file-publishing-role-*` and
  `cdk-hnb659fds-image-publishing-role-*` (asset staging isn't itself a
  mutation — the deploy/exec-role deny is what blocks the CloudFormation
  change).
  - This policy is part of `Nyc311PipelineStack`'s CDK definition from
    its first deploy, not a separate follow-up step. Because the `Deny`
    is scoped to the `nyc311` principal, it doesn't affect the pipeline's
    own service-role principal assuming the same bootstrap role ARNs — so
    the one bootstrap deploy in §6 both stands up the pipeline and
    revokes the `nyc311` profile's own deploy access, atomically, in the
    same changeset.

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
- [ ] Authorize the GitHub CodeStar Connection in the AWS Console (§6, item 1)
- [ ] Deploy `Nyc311PipelineStack` once via `bin/pipeline.ts` (`npm run deploy:pipeline`), under the Deploy Safety Gate (§6, item 2)
- [ ] Confirm the `nyc311` profile can no longer `cdk deploy` (AccessDenied), while `cdk diff`/`synth` still work (§7)
- [ ] Confirm a full pipeline execution succeeds end to end: Source → Synth → Self-Mutate → Deploy `test` → `cdk diff` → Deploy `prod`
- [ ] Push a trivial change to `cdk/pipeline/*.ts` and confirm the self-mutation smoke test (§1.1) — the run picks up the new structure, no stale steps
- [ ] Confirm the failure-notification email arrives on an induced failure
