# ML Driver Assignment — A Network-Aware Dispatch Planner, Trained Locally and Hosted on S3

> **Status: draft for review (2026-11-27).** Decisions Q1–Q7 were settled
> one at a time with Seth. Items still open for review are listed in §11.
> No code is written until the review is done, and nothing is written into
> `ml/` until CLAUDE.md gains its `§5.6 ml/` section (§9).

BoroughSim's dispatch is replaced with a planner that sees the whole
network: every driver (idle, driving or working, where they are, when they
will be free) and every waiting order (where it is, how old it is). It
chooses who goes where, including whether to hold a driver for a better
match a few minutes away. Two models trained locally on Prod history feed
it. A Python Lambda hosts them from S3. No SageMaker, for training or
hosting.

The work is one experiment with three system-wide treatments behind one
flag, measured against a baseline captured **before** any dispatch code
changes:

| Treatment | Cadence | Selection |
|---|---|---|
| `C` | Hourly batch (today) | Oldest `sla_deadline` first, first idle operator the index returns (today) |
| `T1` | Immediate: a pass the moment capacity or demand changes, plus the hourly safety net | Today's selection, unchanged |
| `T2` | Immediate, as `T1` | The network planner (§5), with holds |

`T1 − C` is what immediate dispatch is worth. `T2 − T1` is what the model
is worth.

**Absorbs** [#170](https://github.com/seththeeke/nyc-311/issues/170)
(immediate dispatch, which becomes `T1`, Leg 1),
[#194](https://github.com/seththeeke/nyc-311/issues/194) and
[#253](https://github.com/seththeeke/nyc-311/issues/253) (rules-based
nearest-operator and nearest-of-N order selection, both superseded by the
planner), and [#213](https://github.com/seththeeke/nyc-311/issues/213)
(paid fleet hours in the WBR, Leg 0). Their evidence and saved queries
carry over into §2.

---

## Table of Contents

1. [Goal](#1-goal)
2. [Metrics, declared first](#2-metrics-declared-first)
3. [The flag and the experiment](#3-the-flag-and-the-experiment)
4. [The models](#4-the-models)
5. [The planner](#5-the-planner)
6. [Runtime architecture](#6-runtime-architecture)
7. [Training, replay and promotion](#7-training-replay-and-promotion)
8. [Legs](#8-legs)
9. [Proposed CLAUDE.md §5.6 `ml/`](#9-proposed-claudemd-56-ml)
10. [Ticket and board changes](#10-ticket-and-board-changes)
11. [Open for review](#11-open-for-review)
12. [Appendix A — Decisions and how they were reached](#appendix-a--decisions-and-how-they-were-reached)
13. [Appendix B — Why the model is shaped this way](#appendix-b--why-the-model-is-shaped-this-way)

---

## 1. Goal

Assign drivers more efficiently, so the same demand needs **fewer
drivers**, which lowers variable cost. On the way there, the aggregate
idle time per driver falls and the median time to resolve falls.

The chain the metrics follow:

```
better assignment ─► less idle + less driving per job ─► more jobs per paid driver-hour
                                                     ─► faster time to resolve
                                                     ─► fewer drivers for the same demand ─► lower fleet cost
```

---

## 2. Metrics, declared first

Every metric is declarative SQL over the warehouse, landed as warehouse
jobs in Leg 0 and run daily. All of them exist and have a baseline before
Leg 1 starts. Each one is computed per day and **per dispatch policy**
(from the decision stamp, §2.4), so a treatment's days are compared with
the baseline's days.

### 2.1 The metric tree

| Tier | Metric | Definition |
|---|---|---|
| **Outcome** | **Jobs per paid driver-hour** (primary) | `WORK_COMPLETED` count ÷ paid hours. Paid hours are the deduped `operator_events` intervals, classified as in #213 (`TRANSIT_STARTED` → transit, `WORK_STARTED` → working, `OPERATOR_ADDED`/`WORK_COMPLETED`/`WORK_ABORTED`/`OPERATOR_REMOVAL_REQUESTED` → idle, `OPERATOR_REMOVED` excluded) |
| Outcome | Implied fleet for demand | Orders accepted that day ÷ (jobs per paid driver-hour × 24). The drivers the day's demand needs at that day's efficiency. Noisy day to day because orders arrive in blocks; read over a window |
| Outcome | Fleet cost per resolved order | #213's `fleet_cost` + materials ÷ orders resolved. Reported for the WBR; not deciding, since job mix and materials add noise |
| Driver efficiency | Non-productive share | (idle + transit) ÷ paid hours |
| Driver efficiency | Idle hours per driver-day | Idle hours ÷ driver-days, in aggregate |
| Driver efficiency | Idle with work waiting | Idle hours whose interval began with ≥ 1 accepted, unscheduled order (Celestine's #170 measure) |
| Driver efficiency | Transit minutes per job | Mean `TRANSIT_STARTED` → `WORK_STARTED` |
| Driver efficiency | Drive distance per job | Mean miles from `TRANSIT_STARTED` position to the next `WORK_STARTED` position (#194/#253 method) |
| Driver efficiency | Match delay | Later of (order accepted, operator freed) → `ORDER_SCHEDULED`; p50 and share under 2 min (Kid Kestrel's #170 measure) |
| Holds (`T2` only) | Holds, minutes held, hold hit rate | From `dispatch_decisions` (§2.4). A hold "hits" if the driver it waited for took the order it was held for |
| Resident | Median time to resolve | `ORDER_ACCEPTED` → `ORDER_RESOLVED`, by resolution day |
| Resident | SLA miss rate | Share of resolved orders resolved after `sla_deadline` |
| Resident | Backlog age p90 | p90 age of accepted, unscheduled orders, sampled hourly |
| Guardrail | Max pass-overs | The most times any order was in a planner's considered set and not taken, from `dispatch_decisions` |
| Guardrail | Job-type mix | Share of long jobs (descriptors with ≥ 90 expected work minutes) among resolved orders, against the same share among accepted orders. A policy must not quietly favour short jobs |
| Guardrail | Planner fallback rate | Share of `T2` runs that fell back to `T1` selection (§6.4) |
| Guardrail | Double claims | Operators with two open `TRANSIT_STARTED` without a `WORK_COMPLETED`/`WORK_ABORTED` between them. Must stay 0 |

### 2.2 Where they land

- **#213's columns** (`paid_fleet_hours`, `working_hours`, `transit_hours`,
  `idle_hours`, `fleet_cost`, `idle_cost`, `cost_per_resolved_order`) are
  added to the `wbr` job, as agreed on #213 (Option A, additive SQL,
  applied by Seth to Test then Prod).
- **One new warehouse job, `dispatch_efficiency_daily`**, computes every
  row of §2.1 per day and per `dispatch_policy`. It is rendered on `/data`
  by the existing `GenericResultTable`. Its SQL lives in the spec's Leg 0
  PR as `docs/20-dispatch-efficiency-daily.sql` and is applied by Seth, the
  same as `v1-wbr.sql`.
- The saved queries from the absorbed tickets
  (`fleet-time-budget-daily`, `nearest-operator-bounds`,
  `backlog-dispatch-distance`) are folded into `dispatch_efficiency_daily`
  rather than kept as separate sources of truth.

### 2.3 Baseline

Leg 0 ends with **14 full days of `C`** under the new stamps, recorded in
§8's verification log: every §2.1 metric, plus the job count and the fleet
size. Each treatment's targets are fixed from that baseline before its
dial-up (§3.3).

### 2.4 Decision stamps and the decision log

Every dispatch carries the policy and model that made it, so every metric
can be split by them:

- **Stamped on `ORDER_SCHEDULED`'s payload and `TRANSIT_STARTED`'s
  payload:** `dispatch_policy` (`C`/`T1`/`T2`), `planner_run_id`,
  `trigger` (`SCHEDULE`, `ORDER_ACCEPTED`, `WORK_COMPLETED`,
  `WORK_ABORTED`, `OPERATOR_ADDED`, `HOLD_EXPIRED`), and `model_version`
  (null outside `T2`).
- **A `dispatch_decisions` warehouse source.** One record per committed
  assignment or hold, published best-effort by the scheduling service
  (`service/scheduling/dispatchDecisionService.ts`) to the
  `Nyc311DispatchDecisions-<Env>` SNS topic, landed by the
  `Nyc311Warehouse-DispatchDecisions-<Env>` Firehose into
  `data/dispatch_decisions/` with a Glue table, the same path as
  `public_api_calls`. Fields: `planner_run_id`,
  `decided_at`, `dispatch_policy`, `model_version`, `decision_type`
  (`ASSIGN`/`HOLD`), `operator_id`, `order_id`, `considered_order_ids`,
  `predicted_transit_minutes`, `predicted_work_minutes`, `edge_cost`, and,
  for a hold, `wait_for_operator_id`, `expected_free_at`,
  `predicted_saving_minutes`, `recheck_at`, plus `considered_count`,
  `order_age_rank`, `location_is_fallback` and `distance_miles`. Under
  `C` the considered set is the chosen order and the orders queued behind
  it in the pass, capped at 30.
- Under `C` and `T1`, the record still carries the considered set and the
  cost-to-serve predictions, made with the simulator's own formula (no
  model), so pass-overs and predicted-vs-actual are measurable at baseline.

---

## 3. The flag and the experiment

### 3.1 The flag

`DISPATCH_POLICY`, treatments `C`, `T1`, `T2`, default `C`. Read **once
per scheduling pass** through `getTreatment` (#202), with the empty
context and `fallback: "C"`. No per-operator overrides and no percentage
allocations. The whole system is on one treatment at a time.

### 3.2 Why it's one switch

This is a simulation, so the clean experiment is the whole system on one
policy at a time. A per-driver split would give a planner that reasons
over the whole network only part of the network, and the outcome metrics
(time to resolve, implied fleet size) are fleet-wide. Each decision is
still stamped per driver, so per-driver breakdowns stay available.

### 3.3 Dial-up

Each step is one flag change, system-wide, in Test first, then Prod:

1. **`C` baseline**, 14 days (Leg 0).
2. **`T1`:** Test 2 days (concurrency checks, §6.3) → Prod `T1`, held 14
   days. Compare against the baseline.
3. **Replay gate (§7.2)** passes for `T2` against `T1`.
4. **`T2`:** Test 2 days (planner, holds and fallback logs) → Prod `T2`,
   held 14 days. Compare against the `T1` hold.

**Rollback** is always allowed: set the flag back to the previous
treatment. A broken guardrail (§2.1) at any step rolls back on the same
day.

**Before/after comparison** is exposed to demand swings and to Brogan
changing the fleet size. Every deciding metric is normalised per paid hour
or per job to limit that, and the replay results (§7.2) are reported next
to the live ones as a second read.

---

## 4. The models

Both are trained locally (§7) on **Prod warehouse data only**. Test data
is never used and the export has no option for it. Each model version is a
directory of JSON artifacts in S3 with a manifest (§6.2).

### 4.1 Cost-to-serve model

**Predicts**, for any driver–order pair, `transit_minutes` (driver's
position → job) and `work_minutes` (on site), as two regressions.

- **Algorithm:** gradient-boosted trees (LightGBM, locally), exported as
  plain JSON trees. Evaluated at runtime by a stdlib-only tree walker in
  `ml/planner/`.
- **Labels:** from `operator_events`. Transit is `TRANSIT_STARTED` →
  `WORK_STARTED`; work is `WORK_STARTED` → `WORK_COMPLETED`, joined to
  the order via `ORDER_SCHEDULED`'s `assigned_operator_id`.
- **v1 features:** straight-line miles, origin and destination borough,
  `descriptor`, `priority_tier`, hour of day, day of week. Each feature is
  computed from the raw snapshot (§6.1) by a named function in
  `ml/planner/features.py`. The manifest lists the feature names and
  versions it was trained on, and the planner refuses a manifest naming a
  feature it doesn't implement. **A new input is a code change to
  `features.py` plus a retrain**, the expected way the model grows (§7.3).
- **Quality report:** on a time-ordered held-out split, MAE against the
  simulator's own formula without noise (25 mph straight line, 10-minute
  floor, long-haul brackets; constant per `descriptor`) and against a
  linear regression on the same features.
- **Uses:** the edge cost (§5.2), and predicting **when and where** each
  working driver frees up (their job site, at
  `WORK_STARTED` + predicted work minutes).

### 4.2 Location value model

**Predicts** the expected non-productive minutes (idle + transit) a driver
faces after finishing a job in a given place at a given time: what it is
worth to leave a driver there.

- **Grid:** fixed lat/lng cells of about 2 miles over the NYC bounding
  box, computable with the stdlib. Time is in four 6-hour blocks aligned
  to the order-arrival waves (03/09/15/21 UTC). Sparse cells shrink toward
  their borough × block value, then the global value.
- **Learned from** driver trajectories: for each `WORK_COMPLETED`, the
  realised non-productive minutes until that driver's next
  `WORK_STARTED`, plus the discounted value of where that next job ends
  (one-step TD, discount `γ` in the manifest).
- **Trained on `T1`-period data only.** Under `C`, idle time is dominated
  by waiting for the hourly tick, not by location, so `C`-era trajectories
  would teach the table about the clock. The `T1` hold (§3.3 step 2) is
  what produces the training data, which is why `T2` comes after it.
- **Exported** as a JSON lookup table. The runtime does a dictionary
  lookup.

---

## 5. The planner

Pure-Python, stdlib-only code in `ml/planner/`. The same module runs in
the Lambda (§6) and in replay (§7.2), so replay tests exactly what ships.

### 5.1 Inputs

A snapshot of the network (§6.1):
- **Drivers:** each idle driver, and each driver predicted to free up
  within the hold cap.
- **Orders:** the top `K` waiting orders by `sla_deadline` (default 30,
  in the manifest).

### 5.2 Costs (minutes)

For a driver `d` and an order `o`:

```
edge(d, o) = start_delay(d)              # 0 if idle; predicted minutes until d frees up
           + transit(d.position, o)      # cost-to-serve model; position = d's job site if busy
           + γ · V(cell(o), block(finish(d, o)))   # location value at the end of the job
           − α · age_hours(o)            # older orders are cheaper to take
```

- **Work minutes are not in the edge cost.** They don't depend on who does
  the job, and including them would favour short jobs. They are used only
  to predict `finish(d, o)` and free-up times.
- **Hold options.** Each idle driver also has a "hold" column whose cost
  is the predicted idle minutes until the next driver it could yield to
  frees up. Holding is chosen only when it is cheaper overall than
  assigning that driver now.
- `α`, `γ` and `K` are manifest parameters, tuned in replay (§7.2).

### 5.3 Solve

- A min-cost assignment (Hungarian algorithm, stdlib) over drivers ×
  (orders ∪ hold columns). It's small: about 15 drivers × 30 orders.
- **Hard rules outside the costs**, applied before the solve:
  - An order past its `sla_deadline` must be assigned to the
    lowest-cost available driver, whatever the distance.
  - **Hold cap:** no driver is held when it has already been idle more
    than 15 minutes while orders wait (the operator's `activity_since`,
    §6.1).
  - Orders whose location fell back to `HOME_DEPOT_LOCATION` are excluded
    from distance costs and placed last by age, so a fake distance never
    drives a choice (#194's rule).

### 5.4 Output: a plan

- **Assignments for idle drivers only are committed.** Pairings for
  drivers who are still busy shape the solve but are not stored. The next
  pass re-solves (rolling horizon).
- **Holds** are committed as a decision record with a `recheck_at` (the
  predicted free-up time, capped at the hold cap). A wake-up at
  `recheck_at` triggers a new pass (§6.3), whether or not anything else
  happened.

---

## 6. Runtime architecture

```
 triggers                         serialised                  scheduling Lambda (TS)                planner Lambda (Python)
 ─────────                        ───────────                 ──────────────────────                ───────────────────────
 hourly schedule ───────┐
 ORDER_ACCEPTED ────────┤                                     reads DISPATCH_POLICY once
 WORK_COMPLETED ────────┼──► SQS FIFO, one message group ──►  C / T1: today's selection
 WORK_ABORTED ──────────┤    (one pass at a time,             T2: build snapshot ───────────────►  load manifest + model
 OPERATOR_ADDED ────────┤     bursts batched into one pass)        (DAOs, via service)              (S3, pinned by SSM)
 hold wake-up ──────────┘                                         ◄──────────────────────── plan   features → predict → solve
 (EventBridge Scheduler, one-time)                            commit claims for idle drivers
                                                              write decision records ─► Firehose ─► dispatch_decisions
                                                              schedule hold wake-ups
```

### 6.1 Snapshot (TS → Python), zod- and dataclass-validated on both sides

```
DispatchSnapshot {
  planner_run_id, now, trigger
  drivers: [{ operator_id, current_activity, current_location, activity_since, rate_per_hour,
              current_job: { order_id, job_location, descriptor, priority_tier, phase, phase_started_at } | null }]
  orders:  [{ order_id, job_location | null, location_is_fallback, descriptor, borough,
              priority_tier, accepted_at, sla_deadline }]
}
DispatchPlan {
  planner_run_id, model_version
  assignments: [{ operator_id, order_id, predicted_transit_minutes, predicted_work_minutes, edge_cost, considered_order_ids }]
  holds:       [{ operator_id, wait_for_operator_id, order_id, expected_free_at, predicted_saving_minutes, recheck_at }]
  solver_ms
}
```

- `Operator` gains `activity_since`, the timestamp of its last
  `current_activity` change, set in `foldProjection`. This is the one
  domain model change.
- The snapshot carries raw state only, never features, so a new feature
  never needs a TS change unless it needs new raw state.

### 6.2 Model artifacts

- **Bucket:** `Nyc311ModelArtifacts-<Env>`, versioned, private, laid out
  as `models/dispatch-planner/<version>/` with `manifest.json`,
  `cost_to_serve_transit.json`, `cost_to_serve_work.json` and
  `location_value.json`.
- **Manifest:** version, training data window and row counts, feature
  list, `α`/`γ`/`K`/hold cap, holdout metrics, replay results (§7.2).
- **Pin:** SSM parameter `/nyc311/<env>/dispatch-planner/model-version`,
  read once per planner invocation, never cached across warm invocations
  (CLAUDE.md §5.2). Promoting and rolling back are both a change to this
  parameter.
- Uploads and pin changes are AWS writes and follow CLAUDE.md §3:
  explicit confirmation immediately before each one.

### 6.3 Triggers and concurrency

- **Claim race fix first** (#170 Leg 1, Rex's finding): `startTransit`
  re-checks `ACTIVE`/`IDLE`/no `removal_requested_at` inside
  `foldProjection` against `appendEvent`'s fresh read, and a cancelled
  claim transaction is a skip, not a failure. A truly concurrent test is
  required.
- **One pass at a time.** A network planner can't run twice at once, since
  two runs would plan the same drivers. Every trigger sends a message to
  one SQS FIFO queue (`Nyc311DispatchTriggers-<Env>.fifo`) with a single
  message group. The scheduling Lambda consumes it in batches, so a burst
  of triggers becomes one pass. The hourly schedule targets the same
  queue.
- **Event triggers** (#170's spec): `ORDER_ACCEPTED` on
  `Nyc311OrderEvents`, and `WORK_COMPLETED`, `WORK_ABORTED` and
  `OPERATOR_ADDED` on `Nyc311OperatorEvents`, each filtered by
  `event_type` and sent into the FIFO queue.
- **Hold wake-ups:** a committed hold creates a one-time EventBridge
  Scheduler schedule at `recheck_at` targeting the FIFO queue
  (`ActionAfterCompletion: DELETE`).
- **Under `C`**, an event-triggered pass exits without dispatching, so
  `C` stays hourly-only.

### 6.4 Fallback

Under `T2`, a planner error, a timeout (5 s), an invalid plan or a missing
model pin makes that pass use `T1` selection. The pass logs
`DispatchPlannerFallback` with the reason, and the decision records carry
`dispatch_policy: T1`. A plan's claim conflicts are skipped, as today.

### 6.5 New infrastructure

| Construct | Notes |
|---|---|
| `Nyc311DispatchPlannerLambda` (`Nyc311DispatchPlanner-<Env>`) | `Runtime.PYTHON_3_13`, `Code.fromAsset` of `ml/planner/`, no bundling. `s3:GetObject` on the artifacts prefix, `ssm:GetParameter` on the pin |
| `Nyc311ModelArtifactsBucket` | Versioned, private |
| `Nyc311DispatchTriggersQueue` | FIFO + DLQ + alarm |
| `Nyc311DispatchDecisionsTopic` + `Nyc311Warehouse-DispatchDecisions` Firehose + Glue table | Built in Leg 0b |
| Scheduling Lambda grants | `lambda:InvokeFunction` on the planner, `sns:Publish` on the decisions topic (Leg 0b), `scheduler:CreateSchedule` scoped to a hold-schedule name prefix plus `iam:PassRole` for its role, and the flag `GetItem` (#202) |

---

## 7. Training, replay and promotion

All local, in `ml/`, run by hand. Never in the pipeline, never SageMaker.

### 7.1 Export and train

1. `ml/training/export.py`: read-only Athena queries (`--profile nyc311`)
   over `operator_events`, `order_events`, `order_snapshots`, `requests`,
   `locations` and `dispatch_decisions`, written to the gitignored
   `ml/data/` as Parquet. Prod only.
2. `ml/training/train_cost_to_serve.py` and
   `ml/training/train_location_value.py`: fit, evaluate (§4.1's report)
   and write the artifacts plus a draft manifest to
   `ml/data/artifacts/<version>/`.

### 7.2 Replay: the gate before anything goes live

`ml/replay/` re-runs history through a policy. BoroughSim's world is a
simulator with known rules, so this is a near-exact counterfactual:

- **Inputs:** Prod's real order arrival stream (accepted orders with
  `accepted_at`, location and `descriptor`) and the real roster over time
  (adds and removals) for a chosen window.
- **Simulation:** the production rules for transit and work time
  (`transitTimeService`, `streetConditionProcessingTimeService`, the
  U[1, 2) variance), with a seeded RNG and the same draws for every policy.
  Per-order random factors are drawn by order id, so each policy faces
  identical luck.
- **Policies:** `C` (hourly batch), `T1`, and `T2` using
  `ml/planner/` itself.
- **Calibration check:** replayed `C` must reproduce the window's actual
  §2.1 metrics within 5% (jobs per paid driver-hour, idle share, transit
  minutes per job) before replay results are trusted. If it misses,
  `ml/replay/` is fixed first.
- **Output:** every §2.1 metric per policy, written into the manifest.

**Gate for going live with `T2`:** `T2` beats `T1` on jobs per paid
driver-hour in replay over the most recent 14 days, without breaking a
guardrail (SLA miss rate, max pass-overs, job-type mix).

### 7.3 Promotion and retraining

- **On demand only.** Retraining is expected to be rare, and usually
  comes with **new inputs** (a feature in `features.py` and, if needed,
  new raw state in the snapshot), not just fresh data.
- A new version is promoted only if it beats the pinned version **and**
  `T1` in replay over the most recent 14 days, without breaking a
  guardrail. Promotion is: upload the artifacts (confirmed), then change
  the pin (confirmed). Rollback is moving the pin back.
- No exploration share in v1.
- A scheduled retrain (launchd or an agent posting the replay report to
  Team Chat) is a possible later step, not in scope.

---

## 8. Legs

One isolated, green commit per leg (CLAUDE.md §2 Operational Loop on every
affected package). Pushes may be batched. Each leg ships dark or behind
`DISPATCH_POLICY`.

| Leg | What | Packages | Depends on | Done when |
|---|---|---|---|---|
| **0a** | #213: fleet columns in the `wbr` job (additive SQL in `docs/v1-wbr.sql`, applied by Seth to Test then Prod) | docs | — | Reconciles with the fleet time budget within 2%; existing columns byte-identical |
| **0b** | `DISPATCH_POLICY` flag rows (`C` in both envs). Decision stamps on `ORDER_SCHEDULED`/`TRANSIT_STARTED`, the `dispatch_decisions` Firehose + Glue table, and decision records under `C` (simulator-formula predictions, considered set). No change to which operator or order is chosen | backend, cdk | #202 leg 1 (merged) | Records land in Test and Prod; stamps visible in `order_events`/`operator_events` |
| **0c** | `dispatch_efficiency_daily` warehouse job (`docs/20-dispatch-efficiency-daily.sql`, applied by Seth), shown on `/data` | docs | 0a, 0b | Every §2.1 row present for a Test day and a Prod day |
| **0d** | **Baseline:** 14 days of Prod `C`, recorded below | — | 0c | Baseline table filled in; `T1`/`T2` targets fixed |
| **1a** | Claim race fix in `startTransit` + truly concurrent test (#170 leg 1) | backend | — | Concurrent test passes |
| **1b** | Trigger path: FIFO queue, the event subscriptions, the hourly schedule moved onto the queue, `T1` behind the flag, `trigger` stamped | backend, cdk | 0b, 1a | Test at `T1`: match delay p50 < 2 min, zero double claims |
| **1c** | **Dial-up `T1`:** Test 2 days → Prod 14 days | — | 0d, 1b | `T1` vs baseline recorded |
| **2** | `ml/` package: CLAUDE.md §5.6 added first (§9), scaffold, pipeline step, `export.py`, cost-to-serve training + quality report | ml, cdk/pipeline | §5.6 approved | Quality report beats the linear baseline on holdout; Operational Loop green in `ml/` |
| **3** | `ml/replay/`: `C` and `T1`, calibration check against Prod history | ml | 2 | Replayed `C` within 5% of actuals |
| **4** | Location value model (on the `T1` hold's data) + `ml/planner/` (features, tree walker, value lookup, Hungarian solve, holds, hard rules); `T2` in replay; tune `α`/`γ`/`K` | ml | 1c, 3 | Replay gate (§7.2) passes |
| **5** | Planner Lambda, artifacts bucket, SSM pin, `activity_since` on `Operator`, snapshot builder, `T2` branch in scheduling, hold wake-ups, fallback. First artifacts uploaded and pinned (confirmed) | backend, cdk, ml | 4 | Test at `T2`: plans committed, holds wake up, fallback works when the pin is missing |
| **6** | **Dial-up `T2`:** Test 2 days → Prod 14 days | — | 5 | `T2` vs `T1` recorded; outcome written |

### Leg 0 build notes (2026-11-27)

- **0a:** `docs/v1-wbr.sql` gains the #213 columns. Run read-only against
  Prod: week of Nov 2 `fleet_cost` $104,390.72 (Kid Kestrel's baseline
  $104,373, 0.02% apart), `idle_cost` $19,952.09 ($19,946); fleet − idle
  $84,438.63 against `labor_cost` $84,087.08 (0.4%). Existing columns:
  the only differences from the old SQL are `median_resolution_hours`
  (`approx_percentile`) and cent-level float sums, which differ the same
  way between two runs of the unchanged SQL. Applied 2026-11-27 to Test,
  then Prod, by overwriting `job-definitions/wbr.sql` in each warehouse
  bucket (the admin UI can't edit a job's SQL); rollback is the previous
  version from git (`584d67f`).
- **0b:** built (backend + cdk), pushed 2026-11-27. `DISPATCH_POLICY`
  rows created in Test and Prod (default `C`, no overrides or
  allocations).
- **0c:** `docs/20-dispatch-efficiency-daily.sql` runs read-only against
  Prod (with an empty stand-in for `dispatch_decisions`, which doesn't
  exist until 0b deploys). Days before the stamps show
  `dispatch_policy = UNSTAMPED`. Created as a job in Test and Prod
  2026-11-27; its runs succeed once 0b's `dispatch_decisions` table is
  deployed.

### Verification log

| Period | Policy | Jobs / paid driver-hr | Non-productive share | Idle h / driver-day | Transit min / job | Median TTR | SLA miss | Fleet size |
|---|---|---|---|---|---|---|---|---|
| Baseline (Leg 0d) | `C` | | | | | | | |
| `T1` hold (Leg 1c) | `T1` | | | | | | | |
| `T2` hold (Leg 6) | `T2` | | | | | | | |

### Outcome

*(Written after Leg 6.)*

---

## 9. Proposed CLAUDE.md §5.6 `ml/`

*To be added to CLAUDE.md, reviewed, before Leg 2. Until then `ml/` stays
locked.*

> ### 5.6 ml/
>
> The dispatch planner's models, training and replay
> (`docs/20-ml-driver-assignment.md`). One Python package. Training and
> replay run locally only; `planner/` is deployed as the
> `Nyc311DispatchPlanner` Lambda by `cdk/`. No SageMaker.
>
> -> ml
>  -> planner - the Lambda: `handler.py`, `features.py`, the tree walker,
>     value lookup, solver and hard rules. **Standard library only**; a
>     test fails on any other import. Imported by `replay/`, never the
>     reverse
>  -> training - `export.py` (read-only Athena, Prod only), training and
>     evaluation scripts, manifest writer
>  -> replay - the offline simulator; imports `planner/` so replay runs
>     what ships
>  -> data - gitignored exports and artifacts
>  -> tests - mirrors planner/, training/, replay/
>
> Rules: Python 3.13; `mypy --strict` (no `Any`); dataclasses validated
> at the snapshot boundary; snake_case files; logging as structured JSON
> to stdout, by the same layer rules as backend/. §6.1's comment rules
> apply in spirit (Python `#` comments, 500-character cap).
> It imports nothing from other packages, and nothing imports from it;
> `cdk/` names `ml/planner` by path in one construct only.
>
> | Command | Purpose |
> |---|---|
> | `uv run ruff check .` | lint |
> | `uv run mypy --strict planner training replay` | typecheck (the build gate) |
> | `uv run pytest` | tests |
> | `uv run pytest --cov --cov-fail-under=90` | coverage gate, per file via `coverage report --fail-under` per module |
>
> The pipeline runs lint, typecheck and tests (`planner/` ships). Training
> and replay are never run by the pipeline.

---

## 10. Ticket and board changes

Proposed, not done. Each is made only on Seth's go-ahead:

- **#170:** comment linking this doc ("absorbed as `T1`, Legs 1a–1c"),
  move off Kid Kestrel's board (it's in Spec Created).
- **#194:** close as superseded by this doc (Spec Created on Kid Kestrel's
  board).
- **#253:** close as superseded by this doc (Refined/Assigned).
- **#213:** comment linking Leg 0a. It stays open as the ticket for that
  leg.
- One tracking issue for this doc, labelled `backlog`.

---

## 11. Open for review

Choices this draft made that weren't discussed. Each has a default above;
confirm or change:

1. **Starvation rule.** The draft uses the stateless SLA rule (past
   `sla_deadline` ⇒ assigned first) plus the age term, and *measures*
   pass-overs as a guardrail rather than enforcing #253's "skipped more
   than K times". Enforcing K needs per-order state. Is the SLA rule
   enough?
2. **FIFO serialisation.** Rex rejected a FIFO queue for #170 because it
   serialises dispatch. The network planner needs exactly that, so the
   draft adopts it. Confirm.
3. **Hold cap of 15 minutes**, and `K = 30` orders considered.
4. **Fleet changes during holds.** Brogan keeps recruiting and releasing
   during the 14-day holds. Should he be asked to hold the fleet steady
   during them, or is per-hour normalisation enough?
5. **`dispatch_efficiency_daily` on `/data`** through `GenericResultTable`,
   rather than a dedicated report page.
6. **Hold length.** 14 days per step, against the tickets' usual 7, for
   more days with a backlog at today's volume.

---

## Appendix A — Decisions and how they were reached

Settled with Seth, 2026-11-27, one question at a time.

| # | Question | Decision |
|---|---|---|
| Q1 | What the model predicts | Cost-to-serve, but the **decision is network-wide**: all drivers (state, location, free-up time) against all open orders (location, age), looking ahead at future choices, not just "the right now". Built as two models (cost-to-serve, location value) and a rolling-horizon planner |
| Q1b | Deliberate holds | **Allowed and modelled.** If holding a driver for a better match is the smarter choice, the planner can choose it. A safety cap outside the model, and every hold logged with predicted vs actual |
| Q2 | Success metric | A **metric tree**, not one number: jobs per paid driver-hour → fewer drivers → lower variable cost; supported by idle per driver, time to resolve and the rest of §2.1. Metrics are declared and built where missing |
| Q2b | Order of work | **Measurement first.** Leg 0 builds every missing metric into a report and captures a baseline before any dispatch change |
| Q3 | Experiment design | **One system-wide flag**, no driver cohorts. Simpler to dial up and down. Three treatments in sequence (`C` → `T1` → `T2`) so immediate dispatch and the model are measured separately |
| Q4 | #170, #194, #253 | **All absorbed.** They are the inspiration for this rework. #213 becomes Leg 0a |
| Q5 | Algorithm and hosting | Gradient-boosted trees for cost-to-serve, a zone × time-block value table, Hungarian matching with holds; a **dedicated Python planner Lambda** loading versioned artifacts from S3, pinned by SSM, stdlib only at runtime |
| Q6 | Data and code location | **Prod data only. Test data is never used** and isn't an option. A new top-level `ml/` package (planner, training, replay), opened by a CLAUDE.md §5.6 |
| Q7 | Retraining | **On demand**, expected to be rare and usually adding new inputs, not just refitting. Promotion gated on replay. No exploration in v1 |

## Appendix B — Why the model is shaped this way

- **History has no counterfactuals.** It only shows the order each driver
  was given, never what the alternatives would have cost. A model that
  learns "which choice is best" directly from history would mostly copy
  today's location-blind choices. A cost-to-serve model only needs
  observed outcomes, which history has. The planner turns those
  predictions into choices.
- **The simulator is known.** Transit is straight-line miles at 25 mph
  with a 10-minute floor and long-haul brackets; work is a constant per
  `descriptor`; both are scaled by U[1, 2). The cost-to-serve model will
  mostly rediscover that, which its quality report shows openly. The gain
  comes from the planner's network view and holds, not from hidden
  structure in the data. The known rules are also what make replay a
  near-exact counterfactual, which is why replay is the gate rather than
  live A/B alone.
- **Idle and driving are moved by different things.** Most idle time
  today is waiting for the hourly tick (100% of job starts at :22, gap
  median 25–30 min), which `T1` removes. Driving (17–25% of paid hours,
  8.09 mi against 2.89 mi possible) is what selection changes. Measuring
  `T1` and `T2` separately keeps those two effects apart.
- **Work minutes are kept out of the edge cost and the deciding metric**
  so neither the planner nor the scorecard can win by favouring short
  jobs. The job-type mix guardrail checks it.
- **The location value table waits for `T1` data** because, under hourly
  batching, where a driver finishes barely matters next to when the next
  tick fires.
- **Python for the planner** follows doc 11 §6's pattern (local
  scikit-learn-style training, JSON artifacts, stdlib Lambda). It keeps
  training, replay and serving in one language, so replay runs the exact
  code that ships.
- **Evidence carried from the absorbed tickets:** idle 18–20% of paid
  hours with work waiting (#170); drive distance no better than random
  (8.69 mi actual vs 8.52 all-pairs vs 3.13 nearest, #194); 8.09 mi vs
  2.89 mi to the nearest of the 10 oldest under a backlog (#253); the WBR
  can't see idle cost (#213).
