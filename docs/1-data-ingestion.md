# Data Ingestion — First Backend Slice

> Negotiated **2026-08-10**, same progressive/negotiated style as
> `data-model.md` / `ddb-design.md` / `testing-framework.md`. Scopes and
> designs the first concrete `backend/`+`cdk/` build slice referenced by
> `claude-prompt-initial.md` §10's build order item 1 ("NYC 311 poller
> Lambda + EventBridge Scheduler + DynamoDB cursor storage — get real data
> flowing before building anything else").
>
> This is a **design doc, not a build authorization** — `backend/` and
> `cdk/` remain locked per `CLAUDE.md` §1.1 until those directories get
> their own structure sections. This doc exists so that work, once
> unlocked, has concrete decisions to build against rather than re-deriving
> them mid-implementation.

---

## Decision Status

| Topic | Status |
|---|---|
| [1. Slice scope](#1-slice-scope) | **Agreed** |
| [2. Cursor / checkpoint design](#2-cursor--checkpoint-design) | **Agreed** |
| [3. Backfill & pagination](#3-backfill--pagination) | **Agreed** |
| [4. Data integrity / malformed records](#4-data-integrity--malformed-records) | **Agreed** |
| [5. Failure handling](#5-failure-handling) | **Agreed** |
| [6. ID generation scheme](#6-id-generation-scheme) | **Agreed** (project-wide, not just this slice) |
| [7. Testing](#7-testing) | **Agreed** |
| [8. Observability & custom metrics](#8-observability--custom-metrics) | **Agreed** |
| [9. Environment naming note](#9-environment-naming-note) | **Agreed** |

---

## 1. Slice scope

**Raw ingest only.** The poller polls the NYC 311 SODA API, dedupes against
already-ingested records, and writes each new record as a `draft` `Request`
with `raw_payload` intact (`data-model.md#request`) — full stop.

Explicitly **out of scope** for this slice, deferred to later ones:

- **Location/BBL resolution** (`LocationResolver`, `data-model.md`'s
  `location_resolution_failure` Case path). `Request.status` stays `draft`;
  `location_id` stays null. This is genuinely the next slice, not a step
  inside this one.
- **Promotion/filtering/dedup-decision logic** (`draft`/`pending` →
  `promoted`/`filtered`/`duplicate`/`rejected`). Still `[OPEN]` per
  `claude-prompt-initial.md` §1 — "ingest all NYC 311 complaint types
  unfiltered/lightly filtered... revisit after initial ingestion is
  running." This slice is that initial ingestion; the revisit comes after.
- **Emitting anything downstream** (EventBridge bus / SQS) to kick off the
  Order Workflow. A `draft` Request was never promoted, so there is nothing
  yet for the Order Workflow to act on — the "emit one event per record"
  behavior sketched in `claude-prompt-initial.md` §2 belongs to whichever
  later slice actually promotes a Request, not this one.

Because of this scoping, **this slice needs no event bus/queue at all**:
EventBridge Scheduler → Lambda → DynamoDB is the entire path.

---

## 2. Cursor / checkpoint design

`claude-prompt-initial.md` §2 says to "store last-poll timestamp/cursor in
DynamoDB," but `ddb-design.md`'s seven tables never actually designed a home
for it — a real gap, closed here.

**Decision: a single sentinel item inside the `Requests` table**, not a new
8th table, SSM Parameter Store, or a derived `max(created_at)` query.

- **PK value:** a hardcoded, non-colliding string, e.g. `"CURSOR#nyc_311"`.
  Safe by construction once real `request_id`s are ULIDs (§6) — entirely
  different shape, no collision risk.
- **Invisible to all three GSIs.** The cursor item simply never sets
  `external_unique_key`, `status`, or `location_id` — since all three GSIs
  (`gsi1-external-key`, `gsi2-status`, `gsi3-location`) are sparse, an item
  missing the indexed attribute never appears in that index at all. The only
  way to touch this item is a direct `GetItem`/`PutItem` on its known PK —
  it can never leak into a status/location/dedup query over real Requests.
- **What it tracks:**
  - `last_watermark` — the `created_date` through which the previous poll
    fully drained. Advances **only after a poll window is completely
    drained** (see below) — never mid-window.
  - `resume_offset` (nullable) — set when a run hits its per-invocation
    record cap before finishing the current window (§3); tells the next run
    to resume pagination from that offset in the **same** window instead of
    re-starting from page 1 (wasted API calls) or skipping ahead
    (dropped records). Cleared once the window fully drains and
    `last_watermark` advances.

**Cursor-advance semantics on partial failure:** if a run writes some
records and then fails (timeout, throttle, crash) before finishing the
current window, the watermark does **not** move. The next scheduled run
re-pulls the same window from the top. This is safe, not wasteful, because
`gsi1-external-key`'s dedup check makes re-processing already-written
records a no-op — simplicity over saving a handful of redundant API calls,
which don't matter at this project's volume.

---

## 3. Backfill & pagination

- **First-ever run** (no cursor item exists): bounded initial window of
  **6–24h**, not an unbounded historical backfill. This project is a live
  ongoing stream, not a data warehouse seed — get real data flowing
  immediately with a small, predictable first batch.
- **Per-run record cap**, pages within a single Lambda invocation via the
  SODA API's `$limit`/`$offset`. If a window has more records than the cap
  allows, the run processes what fits, persists `resume_offset` (§2), and
  leaves the watermark unmoved — the next scheduled run continues paginating
  the same window. Every invocation stays fast and bounded; no run risks
  timing out trying to fully drain an unexpectedly large window in one shot.

---

## 4. Data integrity / malformed records

**Lenient.** NYC 311 records vary wildly in shape by `complaint_type`/
`agency` (a noise complaint looks nothing like a pothole report). The only
two fields a Request genuinely can't function without are `unique_key`
(dedup) and `created_date` (ordering/cursor). Anything else missing or odd —
no `complaint_type`, no lat/long, an unfamiliar `agency` value — still gets
written as a `draft` Request with `raw_payload` intact. Matches
`claude-prompt-initial.md` §1's "ingest all NYC 311 complaint types
unfiltered/lightly filtered" framing: no filtering logic exists yet, and
this slice shouldn't invent any by silently dropping records it doesn't
recognize.

---

## 5. Failure handling

An outright failed poll run (SODA API down, DynamoDB throttled, unhandled
exception) gets:

- A **Lambda [on-failure] Destination** (SQS DLQ or SNS) so a failed
  invocation is never silently dropped.
- A **CloudWatch Alarm on repeated failures** across consecutive scheduled
  runs — one missed poll is a non-event (the cursor didn't move, the next
  run catches up); a streak of them is a real signal worth surfacing.

---

## 6. ID generation scheme

**ULID**, project-wide — resolves the item in `ddb-design.md`'s "Still
Open" list ("ID generation scheme... not yet decided for any entity's
primary id"), not just for `request_id`.

Chosen over UUID v4 because ULIDs are lexicographically sortable by creation
time (they encode a timestamp), so an entity's ID order matches its
`created_at` order — genuinely useful when scanning/debugging — while still
being effectively randomly distributed as a DynamoDB partition key (no
hot-key risk from the sortable prefix at this project's volume). Requires a
small library (e.g. `ulid`) since Node has no built-in ULID generator,
unlike `crypto.randomUUID()`.

---

## 7. Testing

The poller's unit/local-sanity tests use a **new, hand-written fixture set**
of NYC 311-shaped JSON records — not the existing real sample pulls in
`311-test-data/`. Deliberately curated edge cases (missing fields, unusual
`agency` values, boundary-of-window `created_date`s) give more reliable,
intentional coverage of the failure modes this Lambda actually needs to
handle than a snapshot of whatever happened to be in a real 6-hour pull.

`311-test-data/` remains what it always was — a reference for what real
field coverage looks like (`data-model.md` Appendix A) — just not the source
of this Lambda's test fixtures.

---

## 8. Observability & custom metrics

Three mechanisms exist for "Lambda → CloudWatch custom metric": a direct
`PutMetricData` call, EMF (a specially-structured log blob CloudWatch
auto-extracts), or a CDK-declared `logs.MetricFilter` over plain structured
logs. Only the third is visible to CDK/CloudFormation at all — the other two
are just strings embedded in imperative Lambda code, invisible to any
CDK-level static check.

**Decision: CDK-declared `MetricFilter`s over plain structured Lambda
logs.**

- The Lambda logs normal structured JSON (e.g.
  `{ event: "PollCompleted", records_ingested, duplicates_skipped,
  records_rejected }`) — zero metrics-awareness in application code.
- `cdk/` declares `logs.MetricFilter` constructs (`AWS::Logs::MetricFilter`
  resources) that pattern-match those log lines and publish the named
  fields as custom metrics. Metric definitions live in infrastructure code,
  reviewable and versioned alongside whatever Alarm/dashboard consumes them
  — not scattered through business logic.
- **Hard cap: never more than 10 custom metrics** (CloudWatch's free tier
  covers the first 10/month; each unique metric-name + dimension
  combination counts separately). Because `MetricFilter` is a real CDK
  construct, this is **genuinely enforceable in `cdk/`** — count
  `MetricFilter` instantiations (a straightforward assertion in a CDK
  assertion test, per `testing-framework.md` §3, or a CDK Aspect) and fail
  the build past 10. This was the whole reason `MetricFilter` was chosen
  over `PutMetricData`/EMF: those alternatives can't be capped this way,
  since CDK has no visibility into arbitrary strings inside a Lambda
  handler.
- **Custom metrics are only created for the `prod` stack — never for
  `test`.** An environment-conditional branch in `cdk/`
  (`if (env === 'prod') { new logs.MetricFilter(...) }`), the same shape
  `testing-framework.md` §3 already flagged as needing "one test per
  branch" to actually exercise both paths.

---

## 9. Environment naming note

The docs use **`test`** and **`prod`** as the two environment names
throughout (`claude-prompt-initial.md` §7/§8, `testing-framework.md` §7).
**"Beta" and "Gamma" are recognized as synonyms for `test`** if they come up
in future conversations — not a third environment. If a real third
environment is ever introduced, that's a deliberate architecture change to
call out explicitly when it happens, not an incidental renaming.

---

## Still Open

- **`X-App-Token` usage** — the brief notes it's optional and raises rate
  limits but "isn't necessary at this volume." Treated as a non-issue for
  now, not a real open question, but worth revisiting if polling frequency
  or record volume ever changes materially.

## Resolved (2026-08-14, GSI key attribute bug)

- **`RequestDao.putRequest` never populated `gsi1pk`/`gsi2pk`/`gsi2sk`/
  `gsi3pk`/`gsi3sk`**, so all three GSIs on the `Requests` table (§2's
  dedup lookup included) had been silently non-functional since the
  poller was first built — `findByExternalUniqueKey` always returned "not
  found," meaning re-polling an overlapping window would have inserted
  outright duplicates instead of skipping them. Found via a manual
  Test-environment run: 2000 records landed in the base table but a
  `gsi2-status` query returned zero. Fixed by giving `Dao.putItem` an
  `additionalAttributes` option (merged onto the item post-validation,
  since zod's default `z.object()` strips unrecognized keys) so
  `RequestDao` can derive and attach the GSI keys without adding them to
  the domain-facing `Request` schema.

## Resolved (2026-08-14, Test-environment manual ingestion test)

- **`SAFETY_LAG_HOURS` raised from 24h to 72h** (§2's cursor design,
  `backend/service/ingestion/nyc311PollerService.ts`). A manual poll
  against `Nyc311-Test` (`test-scripts/1-ingestion-test.py`) surfaced the
  live Socrata feed running ~47h behind real time — beyond the original
  24h estimate. With a 24h floor, the very first poll's window already sat
  entirely ahead of anything the feed had published, so the watermark
  never advanced and ingestion stayed permanently stuck at 0 records.
  `INITIAL_WINDOW_HOURS` (first-ever-run backfill bound, §3) stays at
  24h — a separate concern from this floor, which applies to every run.

## Resolved (2026-08-13, `cdk/` build-out)

- **Exact SoQL query shape** — `backend/service/ingestion/nyc311Client.ts`:
  `$where=created_date > '<watermark>'`, `$order=created_date ASC,
  unique_key ASC` (tie-break for stable offset pagination), paged via
  `$limit`/`$offset`.
- **IAM scoping** for the poller Lambda — `cdk/lambda/Nyc311PollerLambda.ts`
  grants exactly `dynamodb:GetItem`/`PutItem`/`Query` against the
  `Requests` table (table + index ARNs), matching the three DynamoDB calls
  `RequestDao` actually issues. Nothing broader (no `Scan`, `DeleteItem`,
  `UpdateItem`, `BatchWrite*`).
- **EventBridge Scheduler cadence: every 6 hours.** Chosen to keep each
  poll window comfortably inside the 6–24h bound from §3.
- **On-failure handling: SQS dead-letter queue** on the Schedule's target
  (`cdk/lambda/Nyc311PollerSchedule.ts`), plus a CloudWatch Alarm on 3
  consecutive 6-hour periods of Lambda `Errors` (18h of no forward
  progress), emailing `seththeeke@gmail.com` — the same address
  `Nyc311PipelineStack` already notifies on pipeline failure.
- **Requests table physical naming.** `ddb-design.md`'s locked CDK snippet
  hardcodes `tableName: 'Requests'`, which would collide across
  `Nyc311-Test`/`Nyc311-Prod` (same account/region, per `bin/app.ts`).
  Resolved by suffixing per environment — `Requests-Test` /
  `Requests-Prod` — matching the existing `Nyc311-Test`/`Nyc311-Prod`
  stack-naming convention. Key schema, GSIs, billing mode, PITR, and
  removal policy are unchanged from what `ddb-design.md` locked.

---

## Outstanding Items (as of 2026-08-14, end of session)

- **Dedup not yet empirically re-verified.** The passing ingestion test
  started from an empty `Requests-Test`, so `findByExternalUniqueKey`'s
  `gsi1-external-key` lookup never actually had an existing match to find.
  The write side (§2's "Resolved, GSI key attribute bug" above) is
  confirmed fixed, but no run has yet proven that re-polling
  already-ingested data produces `duplicates_skipped > 0` instead of
  inserting new rows.
- **Resumed pagination not yet empirically re-verified.** The cursor
  correctly persisted `resume_offset: 2000` after the last capped run
  (§3), but no follow-up run has confirmed the *next* poll actually
  resumes pagination from that offset rather than restarting or skipping
  ahead.
- **First-run window (`INITIAL_WINDOW_HOURS`, §3) vs. real feed lag.**
  `SAFETY_LAG_HOURS` was raised to 72h, but the first-ever-run window is
  still locked at §3's original 6–24h bound. The Socrata feed's lag was
  observed at ~47h this session — a from-scratch environment (a reset
  Test, or Prod's eventual real bootstrap) would hit the same 0-records
  starvation on its very first run. Worth deciding whether to widen the
  bound, add a manual override, or accept it as a known one-time hiccup.
- **`Nyc311-Prod` unverified and paused.** `Nyc311PollerSchedule-Prod` was
  disabled mid-session once the GSI/dedup bug was found, since Prod had
  likely already run autonomously on its 6h schedule with the broken
  code, writing untrusted (possibly duplicate) data into `Requests-Prod`.
  Remaining: assess what's actually in `Requests-Prod`, decide whether it
  needs cleanup before re-enabling, then re-enable the schedule and
  confirm a clean Prod poll.
- **No on-demand/parameterized poll trigger.** Also logged in
  `docs/99-things-to-come-back-to.md`. Every manual verification this
  session required hand-editing the DynamoDB cursor item directly. A real
  trigger-payload override (e.g. a validated `sinceOverride`) would make
  both future debugging and `test-scripts/1-ingestion-test.py` itself
  less fragile.
- **Minor doc/code naming drift in §8.** The example log shape there uses
  `event: "PollCompleted"`; the actual `logger.ts`/
  `nyc311PollerService.ts` implementation uses `message: "PollCompleted"`
  instead. Functionally harmless — the `MetricFilter`s already key off
  the right field — just needs the doc's example corrected on the next
  real edit to that section.

---

## Addendum: Next-Session Checklist (as of 2026-08-14)

- [ ] Empirically re-verify dedup: poll `Nyc311-Test` a second time over an
      already-ingested window and confirm `duplicates_skipped > 0` instead
      of new rows landing.
- [ ] Empirically re-verify resumed pagination: force a run that hits the
      per-invocation record cap, confirm `resume_offset` persists, then
      confirm the *next* run resumes from it (not restart, not skip-ahead).
- [ ] Decide `INITIAL_WINDOW_HOURS` (§3, still 6–24h) vs. the ~47h real
      feed lag observed this session — widen the bound, add a manual
      override, or explicitly accept the one-time-hiccup risk on any
      from-scratch environment.
- [ ] Assess `Requests-Prod` for possibly-duplicate data written by the
      pre-fix (broken GSI/dedup) code, decide on cleanup if needed, then
      re-enable `Nyc311PollerSchedule-Prod` and confirm a clean Prod poll.
- [ ] Design and build an on-demand/parameterized poll trigger (e.g. a
      validated `sinceOverride` payload) — see also
      `docs/99-things-to-come-back-to.md`'s "Manual/forced polling
      controls" entry.
- [ ] Fix §8's example log field name (`event` → `message`) to match
      `logger.ts`/`nyc311PollerService.ts`.
