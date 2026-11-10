# Sable's memory

## Rotation
| Package | Last audited | Score |
|---|---|---|
| backend | 2026-11-07 | 55 |
| web-app | 2026-11-09 | 55 |
| cdk | never | — |
| customer | never | — |
| tooling | never | — |

Next: cdk.

## Score history
- backend 2026-11-07: 55 (Cx 14, Sprawl 8, Cons 9, Dup 5, Smells 9, AI 10)
- web-app 2026-11-09: 55 (Cx 18, Sprawl 4, Cons 7, Dup 5, Smells 9, AI 12)

## Findings filed
- #172 backend: controller error→status mapping three ways, drifted. Rex: accept (2026-11-08)
- #173 backend: DAO construction copied 38x in 24 services. Rex: accept
- #174 backend: OrderDao envelope 8x / GSI lambda 4x; re-stamp invariant comment-only. Rex: accept, likely a live bug
- #203 web-app: route paths/guards/flags declared in 3-4 places (AppRoutes, menuConfig, Monitoring/AdminPage tiles); PublicRoute skipped by 5 routes
- #204 web-app: authorizedFetch copied 6x; error bodies read 3 ways, 3 by unchecked cast
- #205 web-app: config.ts casts env-config.json, falls back to Test hosts silently

Unfiled backend leads: dead CASE path (caseService stub, orderEvaluationService:229-237); stale comments (dao.ts:7,52; orderDao.ts:427; nyc311RequestService.ts:227); orderEvaluationService holds Orders-stream fan-out; getPipelineStatusController outside any bundle; process.env direct reads; two hand-rolled backoffs.

Unfiled web-app leads: mutation error handling 3 ways (11 empty catches, FeatureFlagEditor local state, AdminWarehousePage:64 swallowed); date formatting 3 ways + tz split (formatters.ts copied in pipeline/ingestion/data); hook shapes 3 ways (21 props in AdminWarehousePage); GenericResultTable≈QueryResultTable; two useInView; duplicate test menuConfig.test.ts:99/107; teamChatService data-mode override vs CLAUDE.md; CLAUDE.md names nonexistent staffMeetingService; nextCursor vs next_cursor; MENTION_HANDLES parallel to TEAM_ROSTER.

## Declined by Rex (don't re-file)
(none)

## Notes
- Label `software-analyzer` created 2026-11-07.
- 2026-11-07: lint/build denied, reports under .claude/ denied. 2026-11-09: `npm --prefix web-app run lint` and `run build` worked (both clean); reports go to agent-reports/.
- Bash: no `$var` expansion or `sed` in commands (denied); use one gh call per search.
- Same-code-same-score anchors: inline per-controller error mapping = -3 sprawl; 38 DAO copies = -3 dup; deliberate-but-identical formatter copies = -1 dup; 3 ways of handling one job = -3 sprawl.
