# Street Condition Specialization — Narrowing Order Handling to One Complaint Type

> **Status (2026-09-14): Topic 1 implemented** — `requestEvaluationService.ts`/
> `orderEvaluationService.ts` changes built, tested (`backend`/`cdk`
> build/lint/test:coverage all green, no coverage regressions), committed
> (`d47ae5a`), and pushed to `main` — **pipeline not monitored this
> round, per explicit instruction; not yet confirmed live in
> `Nyc311-Test`/`Nyc311-Prod`.** Topics 2, 4, 7 are agreed at the design
> level but not yet built. Topics 5/6 are agreed but explicitly flagged
> for a fresh, in-depth pass right before their implementation starts —
> not done yet. Topic 3 (routing) is still deferred, undecided.
>
> Narrows the system from handling any `Request` to servicing exactly one
> `complaint_type` — **"Street Condition"** — end to end, so evaluation,
> scheduling, cost estimation, and the operator-facing UX can all
> hyperoptimize for that one job shape instead of staying generic.
>
> This doc amends three pieces of already-built behavior: of
> `3-order-ingestion.md` §1's three stub filters in
> `requestEvaluationService.ts`, `checkComplaintTypeSupported` and
> `checkBusinessDuplicate` are removed outright, while `checkAlreadyClosed`
> is built for real — rejecting (`FILTERED`) any Request whose raw NYC 311
> payload already carries a `closed_date`, so an already-closed complaint
> never gets ingested at all. It also replaces `5-order-evaluation.md` §2's mock
> `RandomOrderEvaluationRule` with a real complaint-type filter — the
> project's first evaluation rule that actually inspects the `Order`
> instead of sampling. It also removes the Orders/Order Events
> Monitoring-page tiles (dead weight once every Order is the same
> complaint type), and adds new ground: a general admin-toggleable
> feature-flag framework, a brute-force cost-prediction model at
> scheduling time, an experimental locally-trained ML alternative to it
> (on synthetic data, not real NYC 311 data — see §6), and a richer
> fleet-map UX (operator path trails, real route planning).
>
> `backend`/`cdk`/`web-app` are all already unlocked (`CLAUDE.md` §5.1/§5.2/§5.3).
> Negotiated **question by question**, same progressive style as
> `5-order-evaluation.md`/`6-order-scheduling.md`/`9-admin-auth-integration.md`.

---

## Decision Status

Grouped roughly in build-dependency order: cleanup first (unblocks
focus), routing before cost prediction (cost consumes routing's
output), feature flags before cost prediction (cost prediction's
brute-force/ML choice needs one), ML after brute-force (needs a
baseline to compare against), UX last (most independent). Topic 1 is
the only one actually built so far; the rest are negotiated at the
design level only (§3 still open) — see the doc-level status banner
above.

| Topic | Status |
|---|---|
| [1. Evaluation narrowing — drop the ingestion stub filters, replace random order evaluation with a Street-Condition filter](#1-evaluation-narrowing--drop-the-ingestion-stub-filters-replace-random-order-evaluation-with-a-street-condition-filter) | **Implemented (2026-09-14)** |
| [2. Monitoring cleanup — remove the Orders/Order Events tiles and every file that exists only for them](#2-monitoring-cleanup--remove-the-ordersorder-events-tiles-and-every-file-that-exists-only-for-them) | **Agreed (2026-09-14)** |
| [3. Route planning — self-hosted routing vs. a free routing API](#3-route-planning--self-hosted-routing-vs-a-free-routing-api) | **Deferred (2026-09-14)** — user wants to think it over |
| [4. Feature flags — storage, evaluation, and a new Admin tile](#4-feature-flags--storage-evaluation-and-a-new-admin-tile) | **Agreed (2026-09-14)** |
| [5. Cost prediction (brute-force) at scheduling, and where the estimate lives](#5-cost-prediction-brute-force-at-scheduling-and-where-the-estimate-lives) | **Agreed (2026-09-14)** — revisit in depth before implementation |
| [6. ML cost-estimation experiment — synthetic data, local training, and a Python Lambda](#6-ml-cost-estimation-experiment--synthetic-data-local-training-and-a-python-lambda) | **Agreed (2026-09-14)** — revisit in depth before implementation |
| [7. Fleet map UX — truck icons and a fading path trail of an operator's last 5 completed jobs](#7-fleet-map-ux--truck-icons-and-a-fading-path-trail-of-an-operators-last-5-completed-jobs) | **Agreed (2026-09-14)** |

---

## 1. Evaluation narrowing — drop the ingestion stub filters, replace random order evaluation with a Street-Condition filter

**Implemented (2026-09-14).**

Two changes, tightly coupled:

- `requestEvaluationService.ts`'s `FILTERS` array drops
  `checkComplaintTypeSupported`/`checkBusinessDuplicate` outright (they
  were private, unexported, always-`CONTINUE` stubs — removing them is
  behavior-neutral, since nothing rejected through them). `checkAlreadyClosed`
  is instead built for real: it rejects (`FILTERED`) any Request whose
  raw NYC 311 payload already carries a `closed_date` — a complaint
  that was already closed before it was ever ingested never gets
  promoted to an Order. `resolveLocation` and `checkAlreadyClosed` are
  the filters left; ingestion still doesn't pre-filter on
  complaint-type/business-duplicate logic, only on "was this already
  closed" and "can a location be resolved."
- `orderEvaluationService.ts`'s `RandomOrderEvaluationRule` — the
  project's only `OrderEvaluationRule` today, and one that doesn't even
  look at the `Order` it's given — is replaced by a rule that actually
  inspects the Order and rejects anything whose complaint type isn't
  `"Street Condition"`.

The open question this raises: **`Order` itself carries no
`complaint_type` field** (`models/order.ts`'s schema is `order_id`,
`request_id`, `location_id`, `current_stage`, `status`, `priority_tier`,
`sla_deadline`, scheduling/assignment fields — no complaint type). That
lives on the `Request` the Order was created from. So the new rule needs
a way to get from `Order` to its `complaint_type`.

**Question 1a — how does the new rule source `complaint_type`? Agreed:
denormalize it onto `Order` itself**, stamped at creation time in
`requestEvaluationService.ts`'s promote-to-Order step (copied from the
originating `Request.complaint_type`). No lookup needed at evaluation
time; the rule's `evaluate(order: Order)` signature is unchanged.

This is a schema change to `Order`, which raises the same shape of
question the `Operator.name` addition hit (`10-capacity-modeling-and-integration.md`
Leg 2, 2026-09-12): existing `Order` rows in `Nyc311-Test`/`Nyc311-Prod`
predate this field.

**Question 1b — how does the migration land? Agreed: no backfill.**
`Order.complaint_type` is added as `z.string().nullable()` (mirroring
`Request.complaint_type`'s own nullability — NYC 311 source data
sometimes lacks it) and is only ever populated going forward, for newly
created Orders. Existing `Nyc311-Test` operational data (1.1M `Orders`,
361K `Requests`, plus their warehoused history) predates the field and
is not migrated — this project is still early enough that the standing
plan is to wipe operational tables outright rather than backfill them.
`Nyc311-Prod` has zero rows, so nothing to consider there.

**Settled without a separate question, following directly from the
above:**
- The new rule is a single hardcoded target
  (`order.complaint_type === "Street Condition"`), not a data-driven
  allow-list — the ask is specifically "reject everything that isn't
  Street Condition," and a configurable list would be solving a problem
  nobody has yet. Replaces `RandomOrderEvaluationRule` as the default
  rule `evaluateOrder` constructs (`new StreetConditionOnlyRule()` in
  place of `new RandomOrderEvaluationRule()`); `RandomOrderEvaluationRule`
  and its test block are deleted, not left dead in the codebase.
- Deleting `checkComplaintTypeSupported`/`checkBusinessDuplicate` means
  **no code path ever produces `DUPLICATE`/`REJECTED`** on a `Request`
  anymore — `3-order-ingestion.md` §4 already noted these were dead code
  even with the stubs in place. `checkComplaintTypeSupported`'s
  originally-intended future (an admin-configurable per-complaint-type
  allow/deny list) is itself superseded by this doc's
  single-hardcoded-type direction, so there's no reason to keep either
  "build for real later." Those two `RequestStatus` values are removed
  from the enum (`models/request.ts`); **`FILTERED` stays** — it's now
  real, produced by the rebuilt `checkAlreadyClosed`.
  `3-order-ingestion.md` gets a superseded-by note pointing here.
- `requestEvaluationService.ts`'s `FILTERS` array/loop abstraction stays
  as-is even though `resolveLocation` is now its only member — it's
  cheap to keep and is a real extension point (a future non-complaint-type
  filter, e.g. a rate limiter, would still slot in there); this doc's
  "remove the three stubs" ask is about the specific placeholder
  functions, not the pipeline shape around them.

---

## 2. Monitoring cleanup — remove the Orders/Order Events tiles and every file that exists only for them

**Agreed (2026-09-14).** Both `GET /orders` and `GET /order-events` are
used by nothing except the two tiles' own supporting files (confirmed by
grep — no other component/hook/service/controller references either
route). Full deletion, not just unhooking the tiles from
`MonitoringPage.tsx`:

- **Frontend:** the two tile entries in `MonitoringPage.tsx` and their
  routes in `AppRoutes.tsx`;
  `components/pages/{OrderMonitoringPage,OrderEventMonitoringPage}.tsx`;
  `components/orders/{OrderListTable,OrderFilters}.tsx`;
  `components/orderEvents/{OrderEventListTable,OrderEventFilters}.tsx`;
  `hooks/{useOrders,useOrderEvents}.ts`;
  `services/{orderService,orderEventService}.ts`;
  `test-data/{orders,orderEvents}.ts`; every mirrored test file for the
  above. The web-app's `models/order.ts` (scoped to just these two
  pages — distinct from the backend's project-wide `Order` model) goes
  too, since nothing else there imports it.
- **Backend:** `controller/web-api/{getOrdersController,getOrderEventsController}.ts`;
  `models/{orderListQuery,orderEventListQuery}.ts`; the `listOrders`/
  `listOrderEvents` exports in `service/order/orderService.ts` (the file
  itself stays if it has other exports used elsewhere); every mirrored
  test file for the above.
- **CDK:** `lambda/{Nyc311OrdersApiLambda,Nyc311OrderEventsApiLambda}.ts`,
  their route/integration wiring in `api/Nyc311Api.ts` and construction
  in `stack/Nyc311Stack.ts`, their mirrored tests, and the "declares
  exactly N routes" assertion count decremented by 2.
- **Docs:** `4-pipeline-integration-tests.md`'s endpoint-coverage report
  drops both routes' entries.

**Not touched:** `backend/dao/order/orderDao.ts`, the backend's
project-wide `backend/models/order.ts`, and every other
`orderService.ts` export — all used by ingestion/evaluation/scheduling/
execution, not tile-specific.

---

## 3. Route planning — self-hosted routing vs. a free routing API

**Proposed.** Originally scoped as feeding both §5 and §7 — but §5 ended
up deferring real operator-location-aware transit time entirely (see
§5's two explicitly-deferred items), so this topic's only current
consumer is §7's fleet map, which wants an actual road-path polyline to
draw as the connecting line between an operator's last 5 jobs, not a
straight-line guess. Still worth deciding early, since a real routing
answer is also the natural unlock for §5's deferred transit-time item
whenever that gets picked back up.

Every existing external dependency in this project is free-tier,
no-EC2, no-container: OpenStreetMap map tiles (no key, no cost, per
`FleetMap.tsx`), and nothing in `cdk/` runs anything other than
Lambda/DynamoDB/S3/Athena-shaped serverless infra — no Fargate, no ECS,
no EC2, anywhere. `7-data-warehousing.md` Appendix A.2 explicitly
rejected a ~$29–58/month option elsewhere in this project for being the
"only materially non-trivial recurring cost considered anywhere in this
design." Self-hosting a real routing engine (OSRM/Valhalla/GraphHopper)
means loading a compiled NYC road-network extract into a long-running
process — that's a container or EC2 instance running continuously, not
a cold-start-friendly Lambda, and would be the first non-serverless
compute this project has ever introduced.

**Question 3 — which way, and if a free API, which one? Deferred** — you
want to think about this one more before deciding. Doesn't block §5:
that section's cost model is designed against a pluggable
`DistanceEstimator`-shaped interface (mirroring the project's existing
`TransitTimeEstimator`/`ProcessingTimeEstimator`/`LocationResolver`
pattern — mock now, real implementation swaps in later), so §3's answer
just determines what goes inside the real implementation whenever you're
ready to pick.

---

## 4. Feature flags — storage, evaluation, and a new Admin tile

**Agreed (2026-09-14).** Came out of §6's cost-model discussion — rather than an
offline "experiment" with no live ground truth to score against (there's
no real materials-cost feedback loop once an Order actually runs), the
brute-force vs. ML choice becomes a live, admin-toggleable flag: ship
both `MaterialsCostEstimator` implementations, flip between them without
a redeploy, and build confidence in the ML one on real usage before
committing to it as the default. This is deliberately built as a
general framework, not a one-off toggle just for cost — the project
already has one other documented-but-never-built need for exactly this
(`CLAUDE.md` §5.2 / `claude-prompt-initial.md`'s failure-injection mode,
"toggleable by the Admin via a DynamoDB config item or Parameter Store
flag," tracked as [#36](https://github.com/seththeeke/nyc-311/issues/36)
and still unbuilt — confirmed by grep, no chaos-config code exists
anywhere today). Building this now as a real, generic mechanism means
that backlog item has somewhere to plug in later without a redesign —
same "one more thing joins an existing seam" shape as `Operators`
joining the warehouse pipeline in `7-data-warehousing.md` Leg 6.

**Storage: a new `FeatureFlags` table, not SSM Parameter Store.**
Every other piece of admin-managed state in this project already lives
in DynamoDB behind a `Dao<T>` (`Operator`s, `WarehouseJobRuns`
definitions, ...), with the exact "list everything, toggle one thing"
API shape this needs already established by
`GET/POST/DELETE /admin/warehouse/jobs` and `GET/POST/DELETE /capacity`.
SSM Parameter Store would work too (`claude-prompt-initial.md` mentions
it as an alternative) but adds a new AWS API surface (`ssm:GetParameter`/
`PutParameter`) this project has never used, for no benefit over
DynamoDB at this scale — flags are read at most once per scheduling
decision, not a hot Lambda-cold-start path that would benefit from SSM's
own caching layer.

**Shape:** plain (non-event-sourced) entity, `flag_key` (PK, e.g.
`"COST_MODEL"`) + `value` (a plain string, not a typed boolean) +
`updated_at`/`updated_by`. A string value rather than a boolean
covers both shapes a flag needs to take in this project — a genuine
on/off switch (the future failure-injection case) and a named-variant
selector (`"BRUTE_FORCE"` / `"ML"` for the cost model) — without two
parallel flag mechanisms. Each flag's valid values are a convention
documented at its call site, not enforced by the table itself (matching
how `ORDER_SCHEDULED`'s own `cost_model` payload field is just a plain
string today).

**Read path:** a new `getFeatureFlagDao()`/`featureFlagService.ts`,
constructed lazily per the project's established "no module-scope
singleton" rule (`CLAUDE.md` §5.2, the `nyc311RequestService.ts`
cold-start incident). `orderSchedulingService.ts`'s `dispatchOneOrder`
reads the `COST_MODEL` flag once per invocation and picks the matching
`MaterialsCostEstimator` implementation — same shape as every other
injected-dependency choice in that function.

**Write path / Admin UI:** a new Admin tile ("Feature Flags," alongside
Capacity/Scheduling/SQL-Query/Warehouse) → `/admin/feature-flags` →
lists every flag with its current value and a control to change it,
backed by `GET /admin/feature-flags` and `PUT /admin/feature-flags/{key}`
(admin-authorized, same `requireAdminUser` pattern as everything else
under `/admin`). Full stack, mirroring the Capacity/Warehouse-Jobs
precedent exactly: `backend/models/featureFlag.ts`,
`dao/featureFlag/featureFlagDao.ts`, `service/featureFlag/featureFlagService.ts`,
`controller/web-api/{getFeatureFlagsController,updateFeatureFlagController}.ts`,
`cdk/data/FeatureFlagsTable.ts`,
`cdk/lambda/Nyc311{Get,Update}FeatureFlagsApiLambda.ts`; web-app
`models/featureFlag.ts`, `services/featureFlagService.ts` (mock + live),
`hooks/{useFeatureFlags,useUpdateFeatureFlag}.ts`,
`components/featureFlags/FeatureFlagList.tsx`,
`components/pages/FeatureFlagsPage.tsx`, a new tile icon, fixtures, full
mirrored tests.

**Initial flag set:** just `COST_MODEL` (`"BRUTE_FORCE"` | `"ML"`,
default `"BRUTE_FORCE"` until §6's model is trained and trusted). The
mechanism is generic; nothing else gets a flag in this pass.

---

## 5. Cost prediction (brute-force) at scheduling, and where the estimate lives

> **Before writing any code for this section: revisit it in depth one
> more time.** Everything below is agreed at the design level, but by
> your own request this gets a fresh, focused pass right before
> implementation starts — not now, while it's still one of several
> topics in flight.

**Agreed (2026-09-14).** Computed inside `orderSchedulingService.ts`'s
`dispatchOneOrder`, right alongside the existing
`transitEstimator`/`processingEstimator` calls — `MaterialsCostEstimator`
slots into `dispatchOneOrder` as one more injected dependency, the same
shape as those two, with §4's `COST_MODEL` flag choosing which
implementation gets used for a given invocation.

**Question 5a — where does the estimate live? Agreed: extend the
existing `ORDER_SCHEDULED` event, not a new entity or a new event.**
The project has no `WorkOrder` entity — `data-model.md`'s entities are
`Request`/`Order`/`Case`/`Operator`/`Location`/`Shift`/`User` — and
`orderDao.scheduleOrder()` already fires exactly one atomic
`ORDER_SCHEDULED` event per scheduling decision, carrying
`scheduled_start`/`scheduled_end`/`operator_id` in one payload, on the
documented reasoning "one merged event, not a separate `ORDER_ASSIGNED`
append — same one-atomic-write reasoning `acceptOrder` already applied."
That's already the "one snapshot per scheduling attempt" shape a
`WorkOrder` would exist to provide, so a `WorkOrder` entity would just
duplicate it.

`ORDER_SCHEDULED`'s payload grows two fields — `materials_cost_estimate`
and `cost_model: "BRUTE_FORCE" | "ML"` (read straight from §4's flag at
the moment of scheduling, so a historical event always shows which
model actually produced its estimate, independent of whatever the flag
is set to later) — and its existing fold grows the matching nullable
projection fields (`estimated_materials_cost`, `cost_model_used`)
alongside the `scheduled_start`/`scheduled_end`/`assigned_operator_id`
it already sets. `Order.current_stage`/`ORDER_SCHEDULED` already are the
lifecycle and the per-attempt audit record — the live projection holds
the *current* estimate (same as `assigned_operator_id` only ever holding
the *current* operator), and the full attempt-by-attempt history is
whatever's in `OrderEvent`/the warehoused `order_events` table already,
same "operational store = now, warehouse = history" split this project
uses everywhere else. If a real reassignment/re-estimate flow gets built
later (`ORDER_ASSIGNED` is reserved for exactly that), it carries its
own cost snapshot the same way, for free — no new machinery needed now.

**Question 5b — what does "fixed vs. variable" actually mean here?
Agreed, and narrower than originally framed:** labor cost is **not**
predicted or stored at all — it's fully derivable after the fact from
`assigned_operator_id` → `Operator.rate_per_hour` × the scheduled (or,
once execution runs, actual dispatch/resolve) duration, the same
`rate_per_hour × hours` shape `7-data-warehousing.md`'s
`operator_fleet_cost_to_date` job already uses. So there's no "fixed
cost" bucket at all — the only thing this feature predicts and stores is
**materials cost**, via a new pluggable `MaterialsCostEstimator`
(mirrors `TransitTimeEstimator`/`ProcessingTimeEstimator`'s existing
shape: an interface plus a mock/simple v1 implementation, real logic
swaps in later). No existing materials-cost concept exists anywhere in
the codebase today (confirmed by grep) — this is genuinely new ground,
not a rename of something else.

**Two things explicitly deferred, with placeholders left for them
rather than building them now:**
- **Real, operator-location-aware transit time.**
  `TransitTimeEstimator.estimateMinutes(order, location)`
  (`transitTimeService.ts`) computes transit "from the pool's depot" — a
  fixed depot, not wherever the assigned `Operator` actually is (its
  `current_location`). That's a real gap (a Brooklyn-based and a
  Manhattan-based operator get an identical mocked transit time today),
  but fixing it means threading the operator's GPS position into the
  estimator and picking a real distance/time source — both tangled up
  with §3's still-deferred routing decision. Left as a documented,
  unbuilt seam: `TransitTimeEstimator`'s interface and mock are
  untouched by this doc, flagged here as the upgrade path once §3
  lands and this doc's brute-force cost model is proven out.
- **Cost-aware operator selection.** `OperatorDao.findIdleOperator()`
  stays exactly as it is (oldest-idle-first off `gsi1-availability`,
  no location/cost weighting) — this doc adds a cost *estimate* after an
  operator is already chosen, it does not change *which* operator gets
  chosen. Picking the cheaper/closer idle operator when several are
  available is real future work, tracked here but explicitly not part
  of this pass.

**`MaterialsCostEstimator` v1 (brute-force):** a fixed constant, no
inspection of `order`/`request` at all — the exact same shape as
`mockTransitTimeEstimator`/`mockProcessingTimeEstimator`'s own v1s.
Since every Order this system now handles is a Street Condition repair
(§1), one flat number is a legitimate brute-force baseline, not a
placeholder standing in for missing logic — real per-job material
variation (repair size, materials used) is what §6's ML model exists to
improve on.

---

## 6. ML cost-estimation experiment — synthetic data, local training, and a Python Lambda

> **Before writing any code for this section: revisit it in depth one
> more time.** Same standing note as §5 — agreed at the design level,
> but gets a fresh, focused pass right before implementation starts,
> not now.

**Agreed (2026-09-14).** Originally scoped around training on real public NYC 311
data — investigated and abandoned (see below) in favor of a synthetic
dataset built purely as a learning exercise, which sidesteps the real
data's biggest problem: **no public NYC dataset carries a cost figure
for street/pothole repair**, confirmed directly against the live SODA
API this project already ingests from (`erm2-nwe9`, the same "311
Service Requests" dataset `1-data-ingestion.md` polls) — closed "Street
Condition" records have real `descriptor`/`created_date`/`closed_date`
fields but `resolution_description` is boilerplate from a small fixed
set of canned strings, not itemized cost or work detail. A DOT-side
"Street Pothole Work Orders - Closed" dataset also exists
(`x9wy-ing4`, sourced from DOT's MOSAICS system) with a plausible
311-to-work-order join seam (a `source` field with values like `"CSC"`)
but no cost field either, and its ~11K rows against ~492K 311 Street
Condition complaints raised real scope-mismatch questions that were
never resolved (research into it was started and then deliberately
cancelled once the synthetic-data direction was chosen instead).

**Not an "experiment" against a live ground truth.** There's no observed
"actual" materials cost once a synthetic Order runs through this
system — unlike labor cost, nothing ever measures it after the fact. So
this isn't two estimators racing against reality in production; §4's
feature flag is what makes it safe to ship the ML path without needing
that. The actual apples-to-apples comparison (brute-force flat constant
vs. the trained model's predictions, scored against known synthetic
labels) happens **offline**, at training time, on a held-out test split
of the synthetic data — that's where "quality of both" gets measured.

**Question 6a — synthetic dataset shape. Agreed:** `ml/training/generate_synthetic_data.py`
generates 1000 rows to `ml/training/street_condition_synthetic.csv`
(`ml/` per the earlier directory decision — new top-level dir, same
precedent as `test-scripts/`/`scripts/` living outside the locked three).
Columns, chosen to give a trained model real structure to find (a flat
constant can't win against this by construction):

| Column | Shape |
|---|---|
| `descriptor` | 5 categories: `Pothole`, `Cave-in`, `Plate Condition`, `Blocked-Construction`, `Rough Roads` — real NYC 311 Street Condition sub-types, for flavor |
| `defect_size_sqft` | continuous, ~1–50 |
| `borough` | 5 categories |
| `season` | 4 categories (derived from a random date) |
| `materials_cost` (label) | `base_cost[descriptor] + size_coefficient[descriptor] × defect_size_sqft + borough_adjustment[borough] + season_adjustment[season] + gaussian_noise` |

**Question 6b — training approach. Agreed: linear regression, zero
Lambda runtime dependencies** (from your answer above). `ml/training/train_model.py`:
one-hot encodes `descriptor`/`borough`/`season`, fits a plain
`scikit-learn` `LinearRegression` (scikit-learn/pandas are **local
training tools only** — nothing about them reaches the Lambda), does an
800/200 train/test split, and prints each model's MAE against the
held-out 200 — the trained model's predictions vs. a "predict the
training-set mean" brute-force baseline. That printed comparison **is**
the "understand the quality of both" ask, done once, offline, not a
live production feature. Exports `ml/lambda/model.json`: a flat
`{feature_name: coefficient}` dict (one entry per one-hot column) plus
`intercept` — no pickled/joblib model object, no scikit-learn-specific
format, just numbers a dot product can consume.

**The Lambda: pure Python, no bundling step at all.**
`ml/lambda/handler.py` loads `model.json` (bundled alongside it in the
same asset directory) and computes `intercept + Σ(coefficient × feature)`
directly with the stdlib `json` module — no `numpy`, no `scikit-learn`,
no `pip install` anywhere in the deploy path. CDK: a plain
`lambda.Function` (not `aws-lambda-python-alpha`'s `PythonFunction`,
which exists specifically to Docker-bundle pip dependencies this Lambda
doesn't have), `Code.fromAsset("../ml/lambda")`, `Runtime.PYTHON_3_13` —
**the first non-Node.js runtime in this project's `cdk/lambda/`**, but
about as simple as a Lambda gets: one handler file plus one JSON file,
zip-deployed like any static asset. Physical name
`Nyc311MaterialsCostMlLambda-<Env>`, per the env-suffix convention.

**Wiring `MaterialsCostEstimator`'s `"ML"` implementation:** a new
`mlMaterialsCostEstimator` in `service/scheduling/materialsCostService.ts`
(alongside the brute-force one), using `@aws-sdk/client-lambda`'s
`InvokeCommand` to call the Python Lambda synchronously —
`orderSchedulingService.ts`'s `OrderSchedulingLambda` gets
`lambda:InvokeFunction` scoped to just this one Lambda's ARN, same
least-privilege pattern as every other cross-Lambda IAM grant in this
project.

**One real gap, resolved as a documented mock rather than hidden:** of
the four training features, `descriptor` is real (`Request.descriptor`,
looked up the same way `complaint_type` was before §1 denormalized it —
except `descriptor` stays a lookup, it's finer-grained than the
now-hardcoded `complaint_type` and not worth denormalizing for one
consumer) and `borough`/`season` are real (`Location.borough`, current
date). **`defect_size_sqft` has no real counterpart anywhere** — not in
this system's data model, not in NYC 311's own data either (confirmed
in this doc's earlier research). The live `mlMaterialsCostEstimator`
passes a documented mock value for it (a fixed constant, matching
`HOME_DEPOT_LOCATION`/`mockTransitTimeEstimator`'s own "mock now, real
later" shape) — flagged here as a known, deliberate gap: this whole
feature is explicitly a simulation exercise, not a claim that defect
size is actually being measured.

---

## 7. Fleet map UX — truck icons and a fading path trail of an operator's last 5 completed jobs

**Agreed (2026-09-14).** `FleetMap.tsx` (Leaflet + OpenStreetMap tiles,
`10-capacity-modeling-and-integration.md` §6.1) today renders only a
`CircleMarker` per operator, colored by `current_activity`
(IDLE/TRANSIT/WORKING), current position only — "no path/trail
rendering" by its own doc's own words. Two additions:

**Truck icon, not a plain circle.** Swap `CircleMarker` for a `Marker`
with a custom truck-shaped icon (inline SVG via Leaflet's `divIcon`, no
new image asset/CDN dependency), keeping the existing
IDLE/TRANSIT/WORKING color coding as the icon's fill rather than
dropping that signal. The existing `Popup`-on-click behavior is
unchanged.

**The real gap this needs first: an operator's last-5-completed-jobs
location history isn't queryable today.** `Operator.current_location`
is a single folded field (§5's own research already established this —
only "now," no history), and — found while designing this section —
`OrdersTable`'s `gsi2-assigned-operator` (`gsi2pk = assigned_operator_id`,
`gsi2sk = updated_at`) is declared in CDK and documented in
`ddb-design.md` for exactly this shape of access pattern ("Orders
currently assigned to a given Operator") but **is never actually
populated** — confirmed by grep, no code sets `gsi2pk`/`gsi2sk`
anywhere in `orderDao.ts`. Same shape of gap as the already-logged
`event_name`-documented-but-never-wired issue
([#37](https://github.com/seththeeke/nyc-311/issues/37)).

**Fix, as part of this topic:** `orderDao.scheduleOrder()` (the only
place `assigned_operator_id` is ever set today) additionally writes
`gsi2pk = operatorId`, `gsi2sk = updated_at` on the projection. A new
read — `operatorDao`/`orderService` queries `gsi2-assigned-operator`
for a given `operator_id`, `ScanIndexForward: false` (most-recent-first),
over-fetches (`Limit: 20`, to absorb in-progress Orders that would
otherwise crowd out completed ones in a pure recency sort), filters to
`current_stage === "RESOLVE"` in code, and takes the first 5 — each
one's `location_id` resolved to a `Location` via the existing
`locationDao.getLocation`.

**Wired into the existing public `GET /fleet/locations` route**, not a
new route: the response gains `recent_job_locations: GpsLocation[]`
(most-recent-first, up to 5) per operator, alongside the existing
`operator_id`/`name`/`current_activity`/`current_location`. Same
public-safe posture as today — GPS points only, no order details, cost,
or PII — computed with one extra GSI query per active operator per poll
(fine at this project's fleet size; revisit if it ever grows past
today's ~10 operators, same "fine at current scale" call this project
makes elsewhere).

**The trail itself:** for an operator with `N` recent job locations
(0–5), draw `N` connected segments from their current position through
each job, oldest last — `current_position → job₁ → job₂ → ... → job_N`.
Each segment is its own Leaflet `Polyline` (not one polyline with a
single opacity — Leaflet has no per-segment gradient on one line), with
**opacity fading from most-recent to oldest, even linear steps**: the
segment nearest the current position (the most recently completed job)
is `1.0`, then `0.8`, `0.6`, `0.4`, `0.2` for progressively older jobs.
Straight lines between points, not a real road path — §3's routing
decision is still deferred, so this is the same documented
straight-line placeholder every other pre-§3 distance/path concept in
this doc uses, upgradeable once §3 lands without a redesign here.

**Component shape:** `FleetMap.tsx` stays the map container; a new
`OperatorTrail.tsx` (the per-operator marker + its segments) is
extracted rather than inlined, both to keep `FleetMap.tsx` under the
200-line component cap and because "one operator's icon + trail" is a
natural, independently-testable unit. `models/fleetLocation.ts`
(frontend and backend) gain `recent_job_locations`; full mirrored tests
for the model change, the new component, and the DAO/GSI write.

---

## Build Checklist

### Topic 1 — evaluation narrowing — **implemented 2026-09-14**

- [x] `requestEvaluationService.ts`: `checkComplaintTypeSupported`/
      `checkBusinessDuplicate` deleted; `checkAlreadyClosed` built for
      real (rejects `FILTERED` on a `raw_payload.closed_date`);
      `FILTERS` is now `[resolveLocation, checkAlreadyClosed]`.
- [x] `models/request.ts`: `DUPLICATE`/`REJECTED` removed from
      `REQUEST_STATUSES`; `FILTERED` stays (now reachable for real).
- [x] `orderEvaluationService.ts`: `RandomOrderEvaluationRule` deleted;
      `StreetConditionOnlyRule` added (`evaluateOrder`'s new default),
      accepting only `complaint_type === "Street Condition"`.
- [x] `models/order.ts`: `complaint_type` added (nullable, denormalized
      from `Request` at creation via `orderDao.createOrder`); no
      backfill on existing rows, per §1's agreed migration approach.
- [x] `cdk/warehouse/warehouseTableSchemas.ts`: `order_snapshots` gains
      the matching `complaint_type` column, keeping
      `schemaSync.test.ts`'s drift check green — found and fixed as a
      direct consequence of the `Order` schema change, not scoped in
      advance.
- [x] `docs/3-order-ingestion.md`: superseded-by note added where it
      originally proposed all three ingestion filters.
- [x] `backend`/`cdk` build/lint/`test:coverage` all green (896 + 331
      tests, 90%+ per file, no regressions).
- [x] Committed (`d47ae5a`) and pushed to `main`.
- [ ] **Not yet done:** pipeline verification. Pushed without monitoring
      the pipeline, per explicit instruction — `Nyc311-Test`/
      `Nyc311-Prod` deploy status for this change is unconfirmed. Check
      the pipeline before considering this leg actually live.

### Topics 2, 4, 7 — agreed, not yet built

Monitoring cleanup, the feature-flag framework, and the fleet-map UX
are all fully specified above with no open questions, ready to
implement whenever picked up next.

### Topics 5, 6 — agreed, explicitly held for a pre-implementation revisit

Per your own instruction: don't start building the brute-force cost
model or the ML experiment from this doc alone — revisit both in depth
first, right before implementation, not before.

### Topic 3 — still undecided

Self-hosted routing vs. a free API is deferred; nothing downstream is
blocked on it (§5/§7 both use documented placeholders in the meantime).
