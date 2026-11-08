# Sable's memory

## Rotation
| Package | Last audited | Score |
|---|---|---|
| backend | 2026-11-07 | 55 |
| web-app | never | — |
| cdk | never | — |
| customer | never | — |
| tooling | never | — |

Next: web-app.

## Score history
- backend 2026-11-07: 55 (Cx 14, Sprawl 8, Cons 9, Dup 5, Smells 9, AI 10)

## Findings filed
- #172 backend: controller error→status mapping three ways, drifted (TerminalError 409 vs 500)
- #173 backend: DAO construction copied 38x in 24 services; table env names repeated
- #174 backend: OrderDao envelope 8x / GSI lambda 4x; re-stamp invariant comment-only; stream helpers + "#METADATA" duplicated

Unfiled backend leads (report only): dead CASE path (caseService stub, orderEvaluationService:229-237); stale comments (dao.ts:7,52; orderDao.ts:427; nyc311RequestService.ts:227); orderEvaluationService holds Orders-stream fan-out; getPipelineStatusController outside any bundle; process.env direct reads; two hand-rolled backoffs.

## Declined by Rex (don't re-file)

## Notes
- Label `software-analyzer` did not exist; created it 2026-11-07.
- 2026-11-07: `npm run lint`/`build` were denied permission. Writes under .claude/agent-reports/ were denied as "sensitive".
- Same-code-same-score anchors: inline per-controller error mapping = -3 sprawl; 38 DAO copies = -3 dup.
