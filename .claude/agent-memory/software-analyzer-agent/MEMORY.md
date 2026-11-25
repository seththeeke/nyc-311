# Sable's memory

## Rotation
| Package | Last audited | Score |
|---|---|---|
| backend | 2026-11-07 | 55 |
| web-app | 2026-11-09 | 55 |
| cdk | 2026-11-10 | 60 |
| customer | 2026-11-17 | 58 |
| tooling | 2026-11-24 | 51 |

Next: backend, then web-app.

## Score history
- backend 2026-11-07: 55 (Cx 14, Sprawl 8, Cons 9, Dup 5, Smells 9, AI 10)
- web-app 2026-11-09: 55 (Cx 18, Sprawl 4, Cons 7, Dup 5, Smells 9, AI 12)
- cdk 2026-11-10: 60 (Cx 16, Sprawl 7, Cons 9, Dup 5, Smells 9, AI 14)
- customer 2026-11-17: 58 (Cx 16, Sprawl 9, Cons 11, Dup 5, Smells 7, AI 10)
- tooling 2026-11-24: 51 (Cx 12, Sprawl 9, Cons 9, Dup 4, Smells 9, AI 8)

## Findings filed
- #172 backend: controller error→status mapping three ways. Rex: accept; closed
- #173 backend: DAO construction 38x. Rex: accept; fixed by PR #225 (get<X>Dao.ts per DAO)
- #174 backend: OrderDao envelope 8x / GSI 4x. Rex: accept; closed
- #203 web-app: routes/guards/flags in 3-4 places. Rex: accept; closed
- #204 web-app: authorizedFetch 6x. Rex: accept; closed
- #205 web-app: config.ts cast + silent Test fallback. Rex: accept; closed
- #217 cdk: monitored-Lambda list 5 places. Rex: accept; closed
- #218 cdk: NodejsFunction boilerplate 25x. Rex: accept; closed
- #219 cdk: SNS filter/rebuild phases hand-typed. Rex: accept; closed
- #239 customer: DAOs/clients 10 places, 3 styles. Rex: accept; closed
- #240 customer: Bedrock tool JSON specs vs zod parsers. Rex: accept; closed
- #241 customer: status enums unused, humanStatus 4x. Rex: accept; closed
- #263 tooling: package list hand-kept in 3 scripts (worktree/scheduled-run/team), drifted 3x (#95,#103,#175) (filed 2026-11-24)
- #264 tooling: 10 guard hooks 3 styles, fixes not ported (git -C, refs/heads/main, +ref, cwd branch), aws-cost stale .claude/agent-reports path, fail-open vs closed, no tests
- #265 tooling: prompts/CLAUDE.md §9 vs .env drift (devx "3+" vs MAX_OPEN_PRS=5; Rex "hour after Pip"; cadences), devx self-contradiction, dangling refs

Unfiled backend leads: dead CASE path (caseService stub, orderEvaluationService:229-237); stale comments (dao.ts:7,52; orderDao.ts:427; nyc311RequestService.ts:227); getPipelineStatusController outside any bundle; two hand-rolled backoffs. Re-check #172-174 fixes next run.

Unfiled web-app leads: mutation error handling 3 ways; date formatting 3 ways; hook shapes 3 ways; GenericResultTable≈QueryResultTable; two useInView; nextCursor vs next_cursor; MENTION_HANDLES parallel to TEAM_ROSTER.

Unfiled cdk leads: stale comments Nyc311Stack.ts; email dup; PipelineStatusApi hard-coded ids; deny list omits TeamChat stacks; Nyc311Stack ctor 587 lines; lambda/ holds non-Lambdas; 4 identical DLQ alarms.

Unfiled customer leads: 1 of 3 DAOs extends Dao; ResidentIdeaDao pagination 3x; runIdeaActions 120 lines; ByOrder GSI never queried; read API caches 4xx/5xx; action/ folders not in §5.4; NO_ORDER reused; 3 `as never`.

Unfiled tooling leads: agent-scheduled-run.sh 480 lines, KIND branches 4 places, pick_cards subshell wip; MCP wiring OPS_TOOLS→AGENT_OPS_TOOLS→OPS_TOOLS, 25-var line team-chat-config:105, server block 3x, API URLs 2x; scheduler log lines parsed by agent-web-app runLogParser.ts (untested contract); SCHEDULE parser 2x; worktree-name format parsed 3x; report-commit treats rc=1 as failure; agent-board.sh:6 cites deleted script; .env files sourced as shell; eval on MODEL_$SLOT_MODE with unvalidated AGENT_MODE.

## Declined by Rex (don't re-file)
(none)

## Notes
- Label `software-analyzer` created 2026-11-07.
- `npm --prefix <pkg> run lint` / `run build` work (web-app, cdk, customer/backend clean). tooling has no lint/build/test at all. Reports go to agent-reports/ (Write creates the folder).
- Bash: no `$var`, `$(...)`, `sed`, loops with vars, or `--include=*.ts` globs; one gh call per search.
- Rex replies with a statement on the thread (accept/decline); no reply needed unless he asks a question.
- Same-code-same-score anchors: inline per-controller error mapping = -3 sprawl; 38 DAO copies = -3 dup; deliberate-but-identical formatter copies = -1 dup; 3 ways of handling one job = -3 sprawl; mandated per-resource construct copies = 0; hand list drifted from reality = -3 dup; hand-synced schemas that already caused bugs = -3 dup; 10 DAO copies in 3 styles = -3 sprawl and -3 dup; tooling: no tests for any script/hook = -2 AI; prompt >400 lines = -2 AI (once, not per file).
