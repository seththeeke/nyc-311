# Sable's memory

## Rotation
| Package | Last audited | Score |
|---|---|---|
| backend | 2026-11-07 | 55 |
| web-app | 2026-11-09 | 55 |
| cdk | 2026-11-10 | 60 |
| customer | 2026-11-17 | 58 |
| tooling | never | — |

Next: tooling, then backend.

## Score history
- backend 2026-11-07: 55 (Cx 14, Sprawl 8, Cons 9, Dup 5, Smells 9, AI 10)
- web-app 2026-11-09: 55 (Cx 18, Sprawl 4, Cons 7, Dup 5, Smells 9, AI 12)
- cdk 2026-11-10: 60 (Cx 16, Sprawl 7, Cons 9, Dup 5, Smells 9, AI 14)
- customer 2026-11-17: 58 (Cx 16, Sprawl 9, Cons 11, Dup 5, Smells 7, AI 10)

## Findings filed
- #172 backend: controller error→status mapping three ways. Rex: accept; closed
- #173 backend: DAO construction 38x. Rex: accept; fixed by PR #225 (get<X>Dao.ts per DAO)
- #174 backend: OrderDao envelope 8x / GSI 4x. Rex: accept; closed
- #203 web-app: routes/guards/flags in 3-4 places. Rex: accept; closed
- #204 web-app: authorizedFetch 6x. Rex: accept; closed
- #205 web-app: config.ts cast + silent Test fallback. Rex: accept; closed
- #217 cdk: monitored-Lambda list 5 places. Rex: accept (2026-11-11); closed
- #218 cdk: NodejsFunction boilerplate 25x. Rex: accept; open
- #219 cdk: SNS filter/rebuild phases hand-typed. Rex: accept; open
- #239 customer: DAOs/clients built 10 places, 3 styles; backend #173 fix not copied (filed 2026-11-17)
- #240 customer: Bedrock tool JSON specs vs zod parsers disagree; caused f23003e/35f4480 (related: #147 write-side)
- #241 customer: status enums unused, statuses string, literal "CLOSED", humanStatus 4x

Unfiled backend leads: dead CASE path (caseService stub, orderEvaluationService:229-237); stale comments (dao.ts:7,52; orderDao.ts:427; nyc311RequestService.ts:227); getPipelineStatusController outside any bundle; two hand-rolled backoffs.

Unfiled web-app leads: mutation error handling 3 ways; date formatting 3 ways; hook shapes 3 ways; GenericResultTable≈QueryResultTable; two useInView; nextCursor vs next_cursor; MENTION_HANDLES parallel to TEAM_ROSTER.

Unfiled cdk leads: stale comments Nyc311Stack.ts; email dup; PipelineStatusApi hard-coded ids; deny list omits TeamChat stacks; Nyc311Stack ctor 587 lines; lambda/ holds non-Lambdas; 4 identical DLQ alarms.

Unfiled customer leads: 1 of 3 DAOs extends Dao, parse copied 2x; ResidentIdeaDao pagination loop 3x; runIdeaActions 120 lines (ideaActionService:145-265); ByOrder GSI written never queried; residentApiController caches 4xx/5xx 30s + parseLimit on every route (cf. open #149); action/ folders not in CLAUDE.md §5.4; NO_ORDER reused for feature requests; 3 `as never` at Bedrock boundary.

## Declined by Rex (don't re-file)
(none)

## Notes
- Label `software-analyzer` created 2026-11-07.
- `npm --prefix <pkg> run lint` / `run build` work (web-app, cdk, customer/backend clean). Reports go to agent-reports/ (Write creates the folder; `mkdir` needs approval).
- Bash: no `$var`, `$(...)`, `sed`, loops with vars, or `--include=*.ts` globs; one gh call per search.
- Rex replies with a statement on the thread (accept/decline); no reply needed unless he asks a question.
- Same-code-same-score anchors: inline per-controller error mapping = -3 sprawl; 38 DAO copies = -3 dup; deliberate-but-identical formatter copies = -1 dup; 3 ways of handling one job = -3 sprawl; mandated per-resource construct copies = 0; hand list drifted from reality = -3 dup; hand-synced schemas that already caused bugs = -3 dup; 10 DAO copies in 3 styles = -3 sprawl and -3 dup.
