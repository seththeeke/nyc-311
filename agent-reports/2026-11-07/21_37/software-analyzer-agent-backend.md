---
package: backend
score: 55
previous: none
---
# backend · 55/100

| Audit | Score |
|---|---|
| Complexity | 14/20 |
| Pattern sprawl | 8/15 |
| Consistency | 9/15 |
| Divergence and duplication | 5/15 |
| Code smells | 9/15 |
| AI-friendliness | 10/20 |

**Verdict:** Strong typing and zod at every boundary, and the route maps are checked by the compiler. The weakness is copy-paste: the same DAO wiring, error mapping and event boilerplate are rewritten file by file and have started to drift. Most of the lost points come back from three small shared helpers.

## Findings
1. **Controllers map errors to HTTP statuses three ways** (Pattern sprawl): 27 controllers use inline `instanceof` chains, Team Chat uses one table (`teamChat/teamChatRequest.ts:21-27`) and publicV1 uses `publicError`. `TerminalError` returns 409 in 5 controllers (`admin/createFeatureFlagController.ts:45`) and 500 in the rest. `NotFoundError` falls through to 500 in many. The same error gets different codes, and nothing catches it. [#172](https://github.com/seththeeke/nyc-311/issues/172)
2. **DAO construction copied 38 times** (Duplication): 24 service files build their own DAOs. `ORDERS_TABLE_NAME` is spelled out 9 times, and there are three styles (`orderExecutionService.ts:16`, `webhookDispatchService.ts:59`, `warehouseRebuildService.ts:117`). A typo fails only at runtime. [#173](https://github.com/seththeeke/nyc-311/issues/173)
3. **OrderDao boilerplate and a comment-only invariant** (Duplication / AI-friendliness): `dao/order/orderDao.ts` (523 lines) writes out the event envelope 8 times and the GSI lambda 4 times. Lines 51-57 warn that forgetting the GSI keys silently drops an Order from the index, and no code enforces it. [#174](https://github.com/seththeeke/nyc-311/issues/174)
4. **Stream-record helpers duplicated** (Duplication): `newImageSk`/`is…EventRecord`/`is…ProjectionRecord` exist in both `service/order/orderEvaluationService.ts:30-58` and `service/ingestion/operatorEventService.ts:19-41`. `"#METADATA"` is re-typed in 4 files, and the exported `PROJECTION_SORT_KEY` (`dao/dao.ts:8`) is imported nowhere. (In #174.)
5. **Files that hide what they hold** (AI-friendliness): `orderEvaluationService.ts:69` holds the Orders-stream SNS fan-out, which has nothing to do with evaluation. `nyc311RequestService.ts:19-20` admits it covers "two unrelated legs". `controller/web-api/getPipelineStatusController.ts` sits outside any bundle, which breaks CLAUDE.md §5.2. CLAUDE.md asks for one export per file, yet `teamChatService.ts` has 12 and 6 other services have 5 to 7.
6. **Dead CASE path with a misleading comment** (Code smells): `service/case/caseService.ts` is a stub with "no live caller". The `CASE` outcome is never returned (`orderEvaluationService.ts:162-171`), yet the `CASE` branch is still there (229-237). The idempotency comment at 194-197 relies on `case_id`, which `orderDao.ts:217-220` deliberately never sets.
7. **Comments that point at code that isn't there** (Code smells): `dao/dao.ts:7` and `orderDao.ts:427` cite `OrderDao.listOrders` (gone). `dao/dao.ts:52-54` says the event-sourced base is "built when one of those DAOs is", yet it is defined 180 lines lower. `nyc311RequestService.ts:227` names a controller path that moved to `monitoring/`.
8. **Two env-read styles, hand-rolled retries** (Pattern sprawl): `requireEnv` sits beside raw `process.env` reads (`service/ingestion/nyc311Client.ts:44`, `orderExecutionService.ts:36`). Exponential backoff is written separately in `dao/dao.ts:128-138` and `warehouseRebuildService.ts:182-197`. Log event names mix `Dao.getItem` and `PollStarted` styles.

## Since last time
First audit. `npm run lint` and `npm run build` could not be run (the commands were denied permission in this run), so lint and type-check status is unverified.
