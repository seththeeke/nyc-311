---
package: web-app
score: 55
previous: none
---
# web-app · 55/100

| Audit | Score |
|---|---|
| Complexity | 18/20 |
| Pattern sprawl | 4/15 |
| Consistency | 7/15 |
| Divergence and duplication | 5/15 |
| Code smells | 9/15 |
| AI-friendliness | 12/20 |

**Verdict:** The files are small and readable. The layers are respected: no component imports a service, and lint and build both pass. The weakness is repetition: the same jobs are done several different ways, and lists that must match are kept in step by hand across files, so adding or removing a page means editing four files.

## Findings
1. **Each page is declared in 3-4 places** (Duplication): the paths are typed out in `routes/AppRoutes.tsx:125-163`, `shell/menuConfig.ts:105-128` and `pages/MonitoringPage.tsx:28-78` / `AdminPage.tsx:19-33`. Feature-flag and admin-login checks are also set in both the menu and the routes. `PublicRoute.tsx:7-11` says every public page goes through it; 5 skip it (`AppRoutes.tsx:97-124`). No test compares the menu with the routes. [#203](https://github.com/seththeeke/nyc-311/issues/203)
2. **The helper that adds the login token is copied 6 times** (Duplication, Sprawl): `capacityService.ts:20`, `featureFlagService.ts:24`, `warehouseJobDefinitionService.ts:30`, `warehouseJobRunResultsService.ts:17`, `warehouseDataService.ts:19`, plus one inline copy at `warehouseQueryService.ts:21`. API error messages are read 3 ways, and 3 of them use an unchecked `as { message?: string }` cast. [#204](https://github.com/seththeeke/nyc-311/issues/204)
3. **The runtime config is cast, not parsed, and quietly falls back to Test hosts** (Smells): `config.ts:65` casts with `as RuntimeEnvConfig`. The defaults at `:41-42` are Test hosts, and errors are swallowed at `:81`. The doc comment at `:55` is out of date. [#205](https://github.com/seththeeke/nyc-311/issues/205)
4. **Saving or deleting handles failure 3 ways** (Sprawl): 11 components wrap `mutateAsync` in an empty `catch` and rely on the hook's error state; `FeatureFlagEditor.tsx:37` keeps its own error state; `AdminWarehousePage.tsx:64-66` drops the error, so the user sees nothing.
5. **Dates are formatted 3 ways and in different time zones**: identical helpers in `pipeline/`, `ingestion/` and `data/formatters.ts` (each comment says the copy is deliberate), and a fourth copy in `PollerMetricsTable.tsx:8`. Seven inline `toLocaleString()` calls use defaults. `contactFormat.ts:25` uses New York time and `teamFormat.ts:10` uses UTC.
6. **Hooks come in three shapes** (Consistency): one hook bundling a query with its mutations (`useCapacity`, `useFeatureFlags`); one hook per mutation (`useCreate/Update/DeleteWarehouseJob`, whose results `AdminWarehousePage` passes down as 21 props); and 14 hooks that return TanStack's `UseQueryResult` as is.
7. **Near-identical copies**: `data/GenericResultTable.tsx` and `query/QueryResultTable.tsx` differ only by a caption, and their column schemas are copied too (`models/jobResult.ts`, `adHocQueryResult.ts`). Two `useInView` hooks with the same name return different types (`marketing/`, `team/`). One test is written twice, word for word (`menuConfig.test.ts:99` and `:107`).
8. **Conventions have drifted**: `teamChatService.ts:56` uses its own data-mode setting, which CLAUDE.md allows only for services whose API doesn't exist yet. CLAUDE.md also names a `staffMeetingService` that does not exist. Pagination uses `nextCursor` in the resident models and `next_cursor` in the Team Chat models.

## Since last time
First audit.
