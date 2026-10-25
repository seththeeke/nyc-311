# Resource consolidation — stateless resources in `Nyc311Stack`

**Status (2026-10-24):** design agreed, including bundle boundaries (§3.3), routing (§4), rule changes (§6) and rollout (§7). **This pass migrates the admin API only.** The public bundles wait until the admin result has been measured (§7.1). Admin step 1 is deployed to Test and Prod (2026-10-24) and was verified by direct invoke (2026-10-25). Admin step 2 (cutover) is deployed to Test and Prod (2026-10-25); admin step 3 waits on the manual Test checklist. Public step 1 (stand up) is built. The Contacts design (#110) is paused behind this, because Contacts doesn't fit in the stack comfortably as things stand.

---

## 1. Problem

CloudFormation allows **500 resources per stack**, and that limit can't be raised. `Nyc311Stack` is close to it:

| Stack | Resources (2026-10-24, `list-stack-resources`) | Of 500 |
|---|---|---|
| `Nyc311-Test` | 444 | 89% |
| `Nyc311-Prod` | 433 | 87% (no Test-only webhook sink) |

Test always runs ahead of Prod, so Test is the number that matters.

The next feature, Contacts (#110), was estimated at **32–42 resources** when built the way the stack is built today:

| Piece | Resources |
|---|---|
| `Contacts` table | 1 |
| 3 routes, one Lambda per route | 21 |
| Warehouse leg (fan-out Lambda, topic, Firehose, Glue table) | 18 |
| Alarms | 0–2 |

That would put Test at 476–486 (95–97%), leaving room for about one more feature.

### 1.1 Where the resources go

| Type | Count (Test) |
|---|---|
| `AWS::IAM::Role` | 62 |
| `AWS::IAM::Policy` | 60 |
| `AWS::Logs::LogGroup` | 51 |
| `AWS::Lambda::Function` | 45 |
| `AWS::Lambda::Permission` | 28 |
| `AWS::ApiGatewayV2::Route` | 28 |
| `AWS::ApiGatewayV2::Integration` | 28 |
| `AWS::SQS::Queue` / `QueuePolicy` | 17 / 17 |
| `AWS::SNS::Subscription` / `Topic` | 14 / 10 |
| Everything else | 64 |

Most of the count comes in repeating units. Each Lambda brings a role, a policy and a log group. Each API route brings a route, an integration and a permission. The API has **28 routes and 28 Lambdas**, one per route, so the API alone accounts for 196 resources.

### 1.2 Stateless candidates

Every candidate below is stateless: Lambdas, roles, policies, log groups, integrations, permissions, topics, and DLQs that are empty in normal operation. None of them holds data that has to be moved. The only thing lost when they're replaced is the old log history.

| # | Candidate | Today | After | Saved | Effort |
|---|---|---|---|---|---|
| A | API Lambdas: one per route → one per Service API (§3) | 196 | 69 | **~127** | Medium, mostly mechanical |
| B | Warehouse Firehoses: shared delivery role, subscription role and log group | 36 | 11 | ~25 | Low–medium |
| C | Stream fan-out Lambdas (Requests, Locations, Operators, Orders) → one | 24 | 6 | ~18 | Medium |
| D | Schedule failure plumbing: 3 DLQs and 4 failure topics → one of each | ~13 | ~6 | ~7 | Low |
| | **Total** | | | **~177** | |

Not worth it: the 17 SQS queue policies. Most hold only the `enforceSSL` deny statement, and CDK doesn't make it practical to share one policy across queues.

**This doc starts with A.** It's the biggest saving, and on its own it brings Test to about **317 (63%)**. B–D are listed in §8 for later.

---

## 2. Today's API shape

Every route has its own `controller/web-api/<name>Controller.ts`, its own `cdk/lambda/Nyc311<Name>ApiLambda.ts` construct, and its own `HttpLambdaIntegration`. 15 routes sit behind the Cognito JWT authorizer and 13 are public.

| Auth | Route | Lambda (today) | IAM beyond the Users table |
|---|---|---|---|
| Admin | `GET /admin/whoami` | AdminWhoami | — |
| Admin | `GET /capacity` | GetCapacity | Operators read |
| Admin | `POST /capacity` | AddCapacity | Operators read/write |
| Admin | `DELETE /capacity/{operator_id}` | RemoveCapacity | Operators read/write |
| Admin | `POST /scheduling/run` | RunScheduling | `states:StartExecution` |
| Admin | `POST /admin/feature-flags` | FeatureFlag CREATE | FeatureFlags write |
| Admin | `PUT /admin/feature-flags/{flag_key}` | FeatureFlag UPDATE | FeatureFlags read/write |
| Admin | `DELETE /admin/feature-flags/{flag_key}` | FeatureFlag DELETE | FeatureFlags delete |
| Admin | `POST /admin/warehouse/query` | AdHocQuery | Athena, Glue, results bucket read/write/delete |
| Admin | `GET /admin/warehouse/jobs` | ListWarehouseJobs | Jobs table read |
| Admin | `POST /admin/warehouse/jobs` | CreateWarehouseJob | `scheduler:CreateSchedule`, `iam:PassRole`, S3 write |
| Admin | `PUT /admin/warehouse/jobs/{name}` | UpdateWarehouseJob | `scheduler:UpdateSchedule`, `iam:PassRole`, S3 write |
| Admin | `DELETE /admin/warehouse/jobs/{name}` | DeleteWarehouseJob | `scheduler:DeleteSchedule`, S3 delete |
| Admin | `GET /admin/warehouse/jobs/{name}/sql` | GetWarehouseJobSql | S3 read |
| Admin | `POST /admin/warehouse/job-runs/results` | GetWarehouseJobRunResults | S3 read |
| Public | `GET /feature-flags` | FeatureFlag LIST | FeatureFlags scan |
| Public | `GET /feature-flags/{flag_key}` | FeatureFlag GET | FeatureFlags read |
| Public | `POST /feature-flags/{flag_key}/treatment` | FeatureFlag GETTREATMENT | FeatureFlags read |
| Public | `GET /ingestion/metrics` | Metrics | Requests table read |
| Public | `GET /lambda-metrics` | LambdaMetrics | `cloudwatch:GetMetricStatistics` |
| Public | `GET /workspace/metrics` | WorkspaceMetrics | Live metrics table read |
| Public | `GET /fleet/locations` | GetFleetLocations | Operators/Locations read, X-Ray (1769 MB) |
| Public | `GET /data/schema` | WarehouseSchema | Glue read |
| Public | `GET /data/jobs` | WarehouseJobs | Job runs read |
| Public | `GET /data/jobs/{name}/result` | JobResult | Job runs read, S3 read |
| Public | `POST /webhook-subscriptions` | RegisterWebhookSubscription | Subscriptions write, SSM |
| Public | `POST /webhook-sink` | ReceiveWebhookSink (Test only) | Sink table write, SSM read |
| Public | `GET /webhook-sink/deliveries` | GetWebhookSinkDeliveries (Test only) | Sink table scan |

Every admin Lambda also has Users table `PutItem`/`Query` for `requireAdminUser`.

---

## 3. Proposal: one Lambda per Service API

### 3.1 Principles

1. **Lambdas stay thin.** A bundle's entry point is a **router controller**. It reads `event.routeKey`, looks it up in a fixed table, and calls the existing per-route controller. The controllers, services and DAOs keep their current structure. Controllers move into a folder per bundle (§4.1), but their code doesn't change.
2. **Admin and public never mix.** No Lambda serves both an authorized and a public route. Lint enforces this (§4.4).
3. **All admin routes share one Lambda.** Every JWT-authorized route goes into `Nyc311AdminApiLambda`.
4. **Public routes are split by service function.** A public bundle is one service's API, for example feature flags or warehouse data. Public routes are not grouped by HTTP method or "reads vs writes".
5. **One integration per bundle.** CDK reuses an `HttpLambdaIntegration` instance across routes, so each bundle gets exactly one `Integration` and one `Lambda::Permission`. Routes stay one per path, and per-route throttles (`ROUTE_THROTTLES`) don't change.

### 3.2 The admin bundle

`Nyc311AdminApiLambda` serves the 15 admin routes in §2. `GET /admin/warehouse/job-runs`, which replaces public `GET /data/jobs` (§3.3), joins it in the `data` pass, since adding it means changing a public route.

- **Defense in depth.** The admin router refuses any event that has no JWT claims in `requestContext.authorizer`, before it dispatches (§4.3). This catches a public route wired to the admin Lambda by mistake. Each controller still calls `requireAdminUser`, as it does today.
- **IAM is the union of the 15 roles.** That includes `iam:PassRole` and `scheduler:*Schedule` (warehouse jobs), Athena, writes to the Glue results bucket, and `states:StartExecution`. The whoami path would now hold the same permissions as job creation. This is accepted because every route behind the authorizer is reachable only by the single Cognito admin (`9-admin-auth-integration.md`).
- **Settings:**
  - Memory: 512 MB. The feature-flag Lambdas used 512 and the others 256; the bundle loads every admin client, so it takes the larger.
  - Timeout: 5 minutes, kept from `RunScheduling`. API Gateway answers the caller at 30 s, but the scheduling pass `POST /scheduling/run` starts keeps running to completion inside the Lambda. A 30 s timeout would have cut it off. Every other admin route finishes well inside 30 s.

### 3.3 Public bundles (agreed 2026-10-24)

| Bundle | Routes | Notes |
|---|---|---|
| `featureFlags` | `GET /feature-flags`, `GET /feature-flags/{flag_key}`, `POST /feature-flags/{flag_key}/treatment` | The hot path: read on every page load. Its admin writes go to the admin bundle. |
| `data` | `GET /data/schema`, `GET /workspace/metrics` | Workspace metrics move in here (see below). |
| `monitoring` | `GET /ingestion/metrics`, `GET /lambda-metrics` | Pipeline and Lambda health for the Monitoring page. |
| `fleet` | `GET /fleet/locations` | Alone: 1769 MB and X-Ray, unlike any other route. |
| `webhookSubscriptions` | `POST /webhook-subscriptions` | |
| `webhookSink` | `POST /webhook-sink`, `GET /webhook-sink/deliveries` | Test only. A test harness, not a product API. |
| *(future)* `contacts` | `POST /contacts`, `GET /contacts`, `GET /contacts/{id}` | Contacts (#110) |

**Simplifying the public data surface.** The only thing the public site should show is the warehouse relationship diagram. Here is what each public data route is used for today:

| Route | Used by | Change |
|---|---|---|
| `GET /data/schema` | `DataPage` (relationship diagram and schema search); `AdminWarehousePage` (schema panel) | **Keep public.** The diagram needs it. Drop `WarehouseSchemaSearch` from `DataPage`, so the public page shows only the diagram; the admin page keeps the search. |
| `GET /data/jobs` | Only `AdminWarehousePage` (`useWarehouseJobRuns`) | **Move to admin** as `GET /admin/warehouse/job-runs`. `WarehouseJobRunPicker.tsx` already names that path. The web-app service switches to `authorizedFetch`. |
| `GET /data/jobs/{name}/result` | **No component.** `useJobResult` is never imported. Its only other caller is `jobResultApi.integration.test.ts`. | **Delete** the route, its controller and Lambda, the `useJobResult` hook, `getJobResult` in `warehouseDataService`, and the integration test. Keep the job runner's own result writes. |
| `GET /workspace/metrics` | `WorkspaceMetricTile` | **Move into the `data` bundle.** The path stays the same, so the web-app doesn't change. |

### 3.4 Resource math

| | Lambdas | Function + role + policy + log group + integration + permission | Routes | API total |
|---|---|---|---|---|
| Today (Test) | 28 | 168 | 28 | 196 |
| Proposed (Test) | 7 (1 admin + 6 public) | 42 | 27 | 69 |
| Proposed (Prod) | 6 (no sink) | 36 | 25 | 61 |

That saves **127 resources in Test**, taking it from 444 to about **317**. Contacts, built as one more bundle (13) plus its table (1), would then cost about 14 for the API side.

---

## 4. Routing design (for discussion)

### 4.1 Layout

```
backend/controller/web-api/
  shared/            jsonResponse.ts — the only folder every bundle may import
  admin/             adminApiRouter.ts, adminApiRoutes.ts, requireAdminUser.ts,
                     whoamiController.ts, addCapacityController.ts, … (15)
  featureFlags/      featureFlagsApiRouter.ts, featureFlagsApiRoutes.ts, 3 controllers
  data/              dataApiRouter.ts, dataApiRoutes.ts, 2 controllers
  monitoring/        …
  fleet/             …
  webhookSubscriptions/ …
  webhookSink/       …
```

`backend/tests/controller/web-api/` mirrors this structure.

**Public step 1 (2026-10-25)** moved `jsonResponse.ts` to `shared/` and every public controller into its bundle folder. Three controllers stay at the `web-api/` root: `getWarehouseJobRunsController` (it moves to admin in step 2), `getJobResultController` (deleted in step 3) and `getPipelineStatusController`. That last one serves the pipeline stack's own API, not `Nyc311Api`, so it isn't part of this consolidation.

Public routers share `shared/createApiRouter.ts`, which builds the §4.3 router from a bundle name and a `Record<RouteKey, Controller>`. The admin router keeps its own code, since it also checks claims.

### 4.2 Route keys, defined once

Each bundle has `<bundle>ApiRoutes.ts`, a file with no imports that exports its route keys:

```ts
export const DATA_API_ROUTES = ["GET /data/schema", "GET /workspace/metrics"] as const;
export type DataApiRouteKey = (typeof DATA_API_ROUTES)[number];
```

Two things read this file:

- **The backend router** types its dispatch table as `Record<DataApiRouteKey, Controller>`. A missing or extra controller entry is then a compile error.
- **CDK's `Nyc311Api.ts`** imports the same file and creates one route per key, all on the bundle's single integration. A route added on one side but not the other becomes impossible.

This means `cdk/` imports from `backend/`, starting in admin step 2, when routes move to the bundle. Today `cdk/` refers to `backend/` only through path strings (`NodejsFunction` entries). `cdk/tsconfig.json` has no `rootDir`, so `tsc` follows the import. The rule would be that a `*ApiRoutes.ts` file must have no imports, so CDK never pulls in backend dependencies. Lint would enforce that rule.

Per-route auth and throttles stay in CDK. The admin bundle's routes all use the JWT authorizer, and every public bundle's routes use none.

### 4.3 The router

The router is the Lambda's handler, so it's a controller under CLAUDE.md §5.2:

1. Parse only `routeKey` (and, for admin, the JWT claims) through a small zod schema. The per-route controller still parses and logs the full event, as it does today, so the router doesn't log it a second time.
2. Log `<Bundle>ApiRouterDispatch` with the `routeKey`.
3. **Admin only:** if the event has no `sub`/`email` claims, log `AdminApiRouterMissingClaims` and return `500`. That matches `requireAdminUser`: a missing claim means the authorizer is misconfigured, not that the caller sent bad input.
4. Look up the controller and return its result. An unknown `routeKey` logs `<Bundle>ApiRouterUnknownRoute` and returns `404`. That should be unreachable, given §4.2.

### 4.4 Boundaries enforced by lint

`no-restricted-imports` in `backend/eslint.config.js`:

- `controller/web-api/admin/**` may not import any public bundle folder.
- A public bundle may not import `admin/**` or any other public bundle. Only `shared/` is open to all.
- `shared/` imports no bundle, and the root controllers not yet in a bundle import no bundle either.
- A `*ApiRoutes.ts` file may not import anything.

### 4.5 CDK

There's one construct per bundle, `cdk/lambda/Nyc311<Bundle>ApiLambda.ts`. Its entry is the router, its handler is the router's export, and its role is the union of its routes' grants, each still scoped to specific ARNs. `Nyc311Api.ts` takes the bundle Lambdas and their `*_API_ROUTES`. `lambdaMetricsService.ts` then lists bundle function names instead of 28 per-route names.

---

## 5. Pros and cons

**Pros**

- About 127 resources freed, which unblocks Contacts and the next several features without nested stacks or a second stack.
- Fewer constructs to add per route. A new route on an existing service adds a route key and a controller, not a Lambda construct, role, log group and integration.
- Fewer cold starts. Routes in a bundle share warm containers, which helps the low-traffic routes most.
- Logs live in one place per service. A Service API's traffic is in one log group.
- The public data surface shrinks to what the site actually shows.
- The structure has a precedent: `customer/backend`'s read Lambda already serves every customer GET route from one Lambda (`13-customer-simulation.md`).

**Cons**

- **Broader IAM.** A role is the union of its bundle's needs. This matters most for the admin bundle (§3.2); for the public bundles the union is small.
- **Shared concurrency and failure domain.** A slow or crashing route can affect the others in its bundle, and one bad deploy takes out the whole bundle.
- **Bigger bundles.** The cold start is longer per container (though there are fewer cold starts). The admin bundle pulls in the Athena, Scheduler, Step Functions and DynamoDB clients.
- **Per-route Lambda metrics are gone.** `Invocations`, `Errors` and `Duration` become per bundle. Per-route numbers would come from API Gateway's per-route metrics or from log-based `MetricFilter`s.
- **Old logs are lost.** The old log groups are deleted with their Lambdas (DESTROY removal policies), along with their history.
- **A new cross-package import** (`cdk/` → `backend/*ApiRoutes.ts`), limited by lint to files with no imports.

---

## 6. Rules this changes

| Where | Today | Change |
|---|---|---|
| CLAUDE.md §5.2 `controller/` tree | `-> web-api - controller endpoints for the public web api` (flat) | Replace with the bundle layout (§4.1) and the rules: one Lambda per Service API; admin is one bundle; public bundles are split by service function; routers stay thin; a new route on an existing service never adds a Lambda; a new bundle is a design decision (doc + review) |
| CLAUDE.md §5.2 decisions | — | Add the lint boundaries (§4.4) to the bullet that already describes `no-restricted-imports` |
| CLAUDE.md §5.3 `lambda/` and `api/` | One construct per Lambda | One construct per **bundle** (`Nyc311<Bundle>ApiLambda`); `api/` builds routes from the bundle's `*ApiRoutes.ts`, the one sanctioned `cdk/` → `backend/` import |
| `7-data-warehousing.md` §12 / §12b | Public `/data/jobs` and `/data/jobs/{name}/result`; "one Lambda per route" for job CRUD | Note pointing here: result route deleted, job runs moved to admin, CRUD in the admin bundle |
| `11-street-condition-implementation.md` Q3 | Feature flags: "one Lambda per route" | Superseded: public reads in `featureFlags`, admin writes in `admin` |
| `4-pipeline-integration-tests.md` | Per-route GET tests, including `/data/jobs` and `/data/jobs/{name}/result` | Delete the result test; move the job-runs test to the admin route |

---

## 7. Rollout

**Requirement:** no route is deleted until its replacement has been verified, and the stack never goes over the limit along the way.

**Swapping a route's target needs almost no extra room.** A route can point at only one integration, so the cutover is an in-place update to the route, not a second route. When a route moves to the bundle's single integration, CDK removes that route's old integration and permission in the same deploy. Old Lambdas can be **kept**, deployed but unattached, until the move is verified. Parallel "shadow" routes, such as `/v2/...` copies, aren't needed. They would cost a route, an integration and a permission each, for no extra safety.

Each bundle goes through three steps, each a normal pipeline run (DeployTest → integration tests → DeployProd):

| Step | What changes | Resources (admin bundle) | Rollback |
|---|---|---|---|
| 1. Stand up | Add the bundle Lambda, attached to no routes. Verify by invoking it directly in Test with synthetic HTTP API events for its **read** routes (`aws lambda invoke`, after confirmation under CLAUDE.md §3: invoking runs real code, and whoami writes the Users row). | **+4** (function, role, policy, log group): 444 → 448 | Delete the construct |
| 2. Cut over | Point the routes at the bundle. Add any new routes (`GET /admin/warehouse/job-runs`) and switch the web-app to them. Old Lambdas stay deployed but unattached. | +2 integration/permission, −30 old ones: → 420 | Revert the commit; routes point back at the still-deployed old Lambdas |
| 3. Delete | Remove the old Lambda constructs, controllers' old wiring, replaced routes (`GET /data/jobs`) and old integration tests. | −60 (15 × 4): → ~360 | Re-add from git history |

The peak is +4 over today, so headroom is never the constraint.

**Known gap: admin integration tests.** The pipeline's integration tests cover the GET routes, but on the admin side only `GET /admin/whoami`. The other 14 admin routes have no automated check against a deployed stack. Integration tests for the admin reads (`GET /capacity`, `GET /admin/warehouse/jobs`, `GET /admin/warehouse/jobs/{name}/sql`) are **deliberately not added in this pass** (decided 2026-10-24). Until they exist, verifying admin step 2 before step 3 means a manual pass in Test:

- create, update and delete a flag
- add and remove capacity
- create, update and delete a warehouse job
- load a job's SQL and fetch job-run results
- run an ad-hoc query
- run scheduling

**Order:**
1. **Admin first.** It's the largest saving (about 84), it's self-contained, and only one person uses it.
2. **Then `data`.** This includes the deletions and the `DataPage` trim.
3. **Then the rest** in one pass, or one bundle per run.

Removing a public route is done only in step 3, after the web-app no longer calls it, so a browser still running an older bundle keeps working until then.

### 7.1 Progress and measurements (Test)

| When | Step | Resources (Test) | How measured |
|---|---|---|---|
| 2026-10-24 | Baseline | 444 | `list-stack-resources` on `Nyc311-Test` |
| 2026-10-24 | Admin step 1 deployed (`9b592d9`) | **448** (+4: function, role, policy, log group). Prod 433 → 437 | `list-stack-resources` on `Nyc311-Test` and `Nyc311-Prod` after the pipeline run |
| 2026-10-25 | Admin step 2 built (synth) | **420** (−28: 15 integrations and 15 per-route permissions out, 1 of each in). Prod 437 → 409 | Resource count of the pipeline app's synthesized `DeployTest` and `DeployProd` templates |
| 2026-10-25 | Admin step 2 deployed (`9210217`) | **420**, Prod **409**, matching synth. Test has 14 integrations and 14 permissions for 28 routes. The bundle holds one API-scoped permission, and no old admin Lambda holds any | `list-stack-resources`, `lambda get-policy`, and CloudWatch Invocations since cutover: bundle 3 (Test) and 4 (Prod), 0 errors; all 15 old admin Lambdas 0 |
| 2026-10-25 | Public step 1 built (synth) | **436** (+16: four bundles × function, role, policy, log group). Prod 409 → 421 (+12, no sink) | Resource count of the pipeline app's synthesized `DeployTest` and `DeployProd` templates |
| | Public step 2 (cutover) | expected ~413 (−24: 12 public routes' integrations and permissions collapse into 6 bundles; `/data/jobs/{name}/result` keeps its own until step 3; +1 route for `GET /admin/warehouse/job-runs`) | |
| | Step 3 (delete old admin and public Lambdas) | expected ~305 (−60 admin, −44 for 11 replaced public Lambdas, −4 for the two retired `/data/jobs` routes and the result route's integration and permission). Lower than §3.4's 317, because `fleet` and `webhookSubscriptions` reuse their Lambdas and the result route goes | |

Step 1, as built:

- **Backend:**
  - The 15 admin controllers, `requireAdminUser` and their tests moved to `controller/web-api/admin/`. Only their import paths changed.
  - New files: `adminApiRoutes.ts`, `adminApiRouter.ts` and `models/apiRouterEvent.ts`.
  - The §4.4 lint boundaries were added to `eslint.config.js`.
- **CDK:**
  - The old per-route constructs now point at the moved files, so they keep serving every admin route unchanged.
  - New `lambda/Nyc311AdminApiLambda.ts` is instantiated in `Nyc311Stack`, attached to no route.

Step 1 was verified on 2026-10-25 by invoking `Nyc311AdminApi-Test` directly with the admin user's real claims. `GET /admin/whoami`, `GET /capacity`, `GET /admin/warehouse/jobs`, `GET /admin/warehouse/jobs/{name}/sql` and an ad-hoc `SELECT COUNT(*) FROM requests` all returned 200 with live data. An unlisted route key returned 404.

Step 2, as built:

- **CDK:**
  - `Nyc311Api.ts` imports `ADMIN_API_ROUTES` and builds one route per key, all on one `HttpLambdaIntegration` to the bundle.
  - That integration sets `scopePermissionToRoute: false`, so CDK creates one API-scoped `Lambda::Permission` instead of one per route. A public route can reach the bundle only through a CDK change, and the router 404s any key it doesn't list.
  - The 12 old admin constructs and the three admin feature-flag Lambdas are still built in `Nyc311Stack` but aren't routed, so rollback is a revert.
- **Backend:** no change.

To verify step 2 in Test, run the manual checklist in §7 before step 3.

Public step 1, as built:

- **Backend:**
  - `jsonResponse.ts` moved to `shared/`, next to the new `createApiRouter.ts`.
  - The 11 public controllers moved into six bundle folders, each with its `*ApiRoutes.ts` and `*ApiRouter.ts`. Only their import paths changed.
  - The lint boundaries in §4.4 now cover every bundle.
- **CDK:**
  - Four new bundle constructs are stood up in `Nyc311Stack`, attached to no route: `Nyc311FeatureFlagsApiLambda`, `Nyc311DataApiLambda`, `Nyc311MonitoringApiLambda`, and `Nyc311WebhookSinkApiLambda` (Test only).
  - Each bundle's role is the union of the old roles for its routes.
  - The old per-operation sink construct was renamed `Nyc311WebhookSinkOperationApiLambda` to free the name. Its construct IDs are unchanged, so no resource changes.
  - `fleet` and `webhookSubscriptions` get no new Lambda. Each is already one Lambda per route, so step 2 points that existing Lambda's entry at its router in place.
- **Verify** each new bundle by invoking it directly in Test on its read routes (needs confirmation under CLAUDE.md §3):
  - `GET /feature-flags`, `GET /data/schema`, `GET /workspace/metrics`, `GET /ingestion/metrics`, `GET /lambda-metrics`, `GET /webhook-sink/deliveries`.

---

## 8. Later (not in this pass)

- **B: Warehouse Firehoses.** One shared S3 delivery role, one SNS subscription role, and one log group with a log stream per Firehose. First check whether our SNS → Firehose subscription construct accepts a role passed in.
- **C: Stream fan-out.** One Lambda with all four DynamoDB event-source mappings, routing by source table ARN. The Requests fan-out also republishes to the ingestion SQS queue, so it needs a careful split.
- **D: Schedule failure plumbing.** One shared schedule DLQ and one shared alarm topic.
