---
package: customer
score: 58
previous: none
---
# customer · 58/100

| Audit | Score |
|---|---|
| Complexity | 16/20 |
| Pattern sprawl | 9/15 |
| Consistency | 11/15 |
| Divergence and duplication | 5/15 |
| Code smells | 7/15 |
| AI-friendliness | 10/20 |

**Verdict:** The package is small and readable: 40 source files, none over 284 lines, and lint and typecheck are clean. Its weak spot is contracts kept in two places. Tool schemas, status values and DAO wiring are each written out by hand more than once, and the tool schemas have already drifted into two Prod bugs.

## Findings
1. **Tool JSON specs and zod parsers disagree** (Duplication): `finish_idea` is described three times (`ideaActionService.ts:29-48`, `residentIdea.ts:20-28`), and its JSON spec says `follow_up` is a non-null string. `record_idea` requires `feature_request_id` in the JSON spec (`bedrockIdeaGenerator.ts:56`) but zod treats it as optional (`:31`). The feature-request length limits appear only as prose (`actionTools.ts:145-146`). Commits f23003e and 35f4480 fixed Prod bugs from this gap. [#240](https://github.com/seththeeke/nyc-311/issues/240)
2. **DAOs and clients built in 10 places, 3 styles** (Pattern sprawl): `ideaActionService.ts:148-149`, `ideaGenerationService.ts:41,56-57`, `residentReadService.ts:24-32`, `residentSyncService.ts:19`, `webhookReceiverService.ts:18`. `RESIDENTS_TABLE_NAME` is repeated 7 times. Backend's `get<X>Dao` fix (#173) was never copied here, and the Bedrock `getBedrockClient()` defaults are never used in production. [#239](https://github.com/seththeeke/nyc-311/issues/239)
3. **Status enums unused, statuses typed as string** (Code smells): `boroughSimPublicApi.ts:10-11` declares status constants nothing imports. `ideaContext.ts:51` compares against a literal `"CLOSED"`, and the status-to-text snippet appears 4 times (`actionTools.ts:111`, `ideaContext.ts:88,100,122`). [#241](https://github.com/seththeeke/nyc-311/issues/241)
4. **The DAO base class is used by 1 of 3 DAOs** (Consistency): `ResidentDao` and `ResidentIdeaDao` don't extend `dao/dao.ts` and each copies its `validate` as a private `parse` (`residentDao.ts:131`, `residentIdeaDao.ts:279`). `ResidentIdeaDao` has three paginated query loops (`:102,125,191`) and two near-identical index list methods (`:59,76`).
5. **`runIdeaActions` is one 120-line function** (Complexity): `ideaActionService.ts:145-265` combines a `for(;;)` loop, five mutable locals and two closures. The forced-finish arithmetic (`:208`, `:214`) depends on `unusableTurns` being tracked separately from the steps.
6. **Dead `ByOrder` index** (Code smells): every idea writes `by_order_pk` (`ideaGenerationService.ts:90`), and the GSI is provisioned in `cdk/customer/ResidentIdeasTable.ts:22`, but nothing in the package queries it.
7. **Error responses cached publicly** (Code smells): `residentApiController.ts:46,59-61` attaches `Cache-Control: public, max-age=30` to 400, 404 and 500 responses. `parseLimit` (`:19`) runs on every route, so a bad `limit` returns 400 even on routes that ignore it.
8. **Layout differs from CLAUDE.md §5.4** (AI-friendliness): `controller/action/` and `service/action/` aren't in the documented structure. `newPickKey` lives in `service/idea/ulid.ts` but is imported by the webhook service. `NO_ORDER = "NONE"` is also used as the "no feature request" sentinel (`bedrockIdeaGenerator.ts:51,114`). Three `as never` casts sit at the Bedrock boundary (`ideaActionService.ts:98,108`, `bedrockActionModel.ts:42`).

## Since last time
First audit.
