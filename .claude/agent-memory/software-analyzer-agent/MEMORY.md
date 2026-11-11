# Sable's memory

## Rotation
| Package | Last audited | Score |
|---|---|---|
| backend | 2026-11-07 | 55 |
| web-app | 2026-11-09 | 55 |
| cdk | 2026-11-10 | 60 |
| customer | never | — |
| tooling | never | — |

Next: customer, then tooling.

## Score history
- backend 2026-11-07: 55 (Cx 14, Sprawl 8, Cons 9, Dup 5, Smells 9, AI 10)
- web-app 2026-11-09: 55 (Cx 18, Sprawl 4, Cons 7, Dup 5, Smells 9, AI 12)
- cdk 2026-11-10: 60 (Cx 16, Sprawl 7, Cons 9, Dup 5, Smells 9, AI 14)

## Findings filed
- #172 backend: controller error→status mapping three ways, drifted. Rex: accept (2026-11-08)
- #173 backend: DAO construction copied 38x in 24 services. Rex: accept
- #174 backend: OrderDao envelope 8x / GSI lambda 4x; re-stamp invariant comment-only. Rex: accept, likely a live bug
- #203 web-app: route paths/guards/flags in 3-4 places; PublicRoute skipped by 5 routes. Rex: accept (medium) 2026-11-10
- #204 web-app: authorizedFetch copied 6x; error bodies read 3 ways. Rex: accept (medium)
- #205 web-app: config.ts casts env-config.json, falls back to Test hosts silently. Rex: accept (small, soon)
- #217 cdk: monitored-Lambda list in 5 places, 8 of 24 Lambdas missing
- #218 cdk: NodejsFunction boilerplate 25x; 10 lack log-group DESTROY, tracing 1/25; TeamChatFunction/CustomerFunction unused pattern
- #219 cdk: SNS filter event types + rebuild phases hand-typed, unchecked vs backend; lowercase phases

Unfiled backend leads: dead CASE path (caseService stub, orderEvaluationService:229-237); stale comments (dao.ts:7,52; orderDao.ts:427; nyc311RequestService.ts:227); orderEvaluationService holds Orders-stream fan-out; getPipelineStatusController outside any bundle; process.env direct reads; two hand-rolled backoffs.

Unfiled web-app leads: mutation error handling 3 ways; date formatting 3 ways + tz split; hook shapes 3 ways (21 props in AdminWarehousePage); GenericResultTable≈QueryResultTable; two useInView; duplicate test menuConfig.test.ts:99/107; teamChatService data-mode override; CLAUDE.md names nonexistent staffMeetingService; nextCursor vs next_cursor; MENTION_HANDLES parallel to TEAM_ROSTER.

Unfiled cdk leads: stale comments Nyc311Stack.ts:398,495,512,525-526,640, RebuildSM:37 vs 58, websiteHostingTargets:4, PipelineStack:174,342; email dup (Stack:132/Pipeline:55); PipelineStatusApi hard-coded origins/CloudFront ids; deny list (PipelineStack:429-431) omits Nyc311TeamChat-Test/Prod; Nyc311Stack ctor 587 lines; lambda/ holds 17 non-Lambdas, 6 Lambdas elsewhere; teamChat 8 src/1 test, agents 11/1; 4 identical DLQ alarms + 6 failure topics; test statementsOf helper 9x; IntegrationTestStep target "test"/"prod" lowercase.

## Declined by Rex (don't re-file)
(none)

## Notes
- Label `software-analyzer` created 2026-11-07.
- `npm --prefix <pkg> run lint` / `run build` work (web-app, cdk clean). Reports go to agent-reports/.
- Bash: no `$var`, `$(...)`, `sed`, or `--include=*.ts` globs (zsh nomatch); one gh call per search.
- Same-code-same-score anchors: inline per-controller error mapping = -3 sprawl; 38 DAO copies = -3 dup; deliberate-but-identical formatter copies = -1 dup; 3 ways of handling one job = -3 sprawl; mandated per-resource construct copies (topics/queues) = 0; hand list drifted from reality = -3 dup.
