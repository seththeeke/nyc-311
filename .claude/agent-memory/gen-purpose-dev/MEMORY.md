# Kid Kestrel memory

## Projects
| Issue | Title | State | Spec | Flag |
|---|---|---|---|---|
| #202 | backend: read feature flags in services | In Intake on 2026-11-13. Was parked 2026-11-10: the AWS profile was missing, so there was no Logs Insights baseline | none yet (planned `docs/kid-kestral/202-backend-read-feature-flags-in-services.md`) | none (ships with no caller; first caller #170/#194 is its dial-up) |
| #213 | WBR: paid fleet hours, idle, fleet cost | Back to Intake 2026-11-13: "Flag: none needed", and the `wbr` job is applied by hand. I proposed A (Seth exempts additive warehouse-job SQL; the CEO applies Test→Prod) or B (separate `wbr_fleet` job + a flagged reader) | none | none |
| #194 | Dispatch the nearest idle operator | Spec Created 2026-11-13 (commit 6d19f8e) | `docs/kid-kestral/194-dispatch-the-nearest-idle-operator-to-each-order-not-whichever-the-index-returns-first.md` | `NEAREST_OPERATOR_DISPATCH` (rows not created yet). Leg 1 depends on #202 |
| #170 | Event-driven dispatch | Spec Created 2026-11-14 (commit 282fd1c). Asked Celestine/Rex to confirm `WORK_COMPLETED` instead of `ORDER_RESOLVED` | `docs/kid-kestral/170-dispatch-the-next-order-the-moment-an-operator-frees-up-not-only-on-the-hourly-scheduling-run.md` | `EVENT_DRIVEN_DISPATCH`. Leg 1 (claim race) has no dependency; Leg 2 depends on #202 |

## Flags I own
- `NEAREST_OPERATOR_DISPATCH` (#194): C = first-available, T1 = nearest. Read once per scheduling run with empty context.
- `EVENT_DRIVEN_DISPATCH` (#170): C = ignore the event, T1 = run `scheduleOrders` on it. Read per event in a new `eventDrivenSchedulingService.ts`.

## Baselines taken
- #194, 2026-11-13: drive distance 8.16 mi actual / 8.69 all-pairs / 3.22 nearest (Nov 10-12, 396 jobs). Median resolve 173.72 h and 69.1% late (resolved Nov 6-12). Drive share by day, Nov 6-12: 21.2 to 11.0%.

- #213, 2026-11-13: fleet time budget split at Monday weeks. Oct 26: $38,217 fleet / $6,946 idle (849 paid h). Nov 2: $104,373 / $19,946 (2,319 h; 1,391 working, 485 transit, 443 idle). Fleet − idle is within 0.4% of WBR labor ($84.1k).

- #170, 2026-11-14: match delay (scheduled − later of accept/operator-freed) p50 27.4-38.7 min, 0.6-4.5% within 2 min, Nov 7-12. 100% of starts at :22. Idle 18.7-20.2% on Nov 7-9 (backlog >0). The backlog emptied daily from Nov 10. 0 double claims since Oct 1.

## Lessons
- Log lines use the key `message`, not `msg` (backend/logger.ts). #194's V2 query says `msg`: fix it when that spec is revised.
- `ORDER_RESOLVED` is appended before `completeWork` (operator IDLE). For "operator freed", use `WORK_COMPLETED` on `Nyc311OperatorEvents` (it carries an `event_type` attribute). `TRANSIT_STARTED` carries only `location`, not `order_id` (the reference is wrong); `ORDER_SCHEDULED.payload.operator_id` links the two.
- Per-dispatch metrics (match delay, miles per job) beat share-of-paid-hours metrics as deciders. Athena `sequence()` needs a plain TIMESTAMP; wrap the result with `with_timezone(h,'UTC')`.
- "Flag: none needed" fails my bar even with both approvals: send it back to Intake with a flaggable split or an exemption request. Warehouse jobs (`wbr`, `docs/v1-wbr.sql`) are applied by hand through the admin UI, so a human applies them, never me. `get_wbr` reads job_name `wbr` only.
- Check a CTO comment's event names against the query-builder reference. Rex once cited events that don't exist (`IdleStarted`, `CheckedOut`).
- Check the §22.2 block line by line: a ticket can carry both approval labels and still lack `Dial-up:`. Drafts in the body count only if every line is there.
- `run_query` is warehouse SQL only. The budget is small: 3 queries left 4, then 2. Plan the queries before the first one. Operator payloads carry `$.location.lat/lng`.
- The AWS profile `nyc311-gen-purpose-dev` was still missing on 2026-11-13. Check it early (`aws --profile nyc311-gen-purpose-dev sts get-caller-identity`). When the deciding metric is in the warehouse, proceed and list the profile under Needs the CEO. Pipes to `sed` need approval.
- Share-of-paid-hours metrics move with demand (idle rose sharply from Nov 10). Prefer per-job metrics as the deciding measure.
- Bash rejects `$(...)` substitution and heredocs. For a comment body: `mktemp`, Read the empty file, Write it, then `--body-file`.
- #202 code facts: `featureFlagService.getTreatment(flagKey, ctx, {fallback})` has no callers. It rethrows DynamoDB errors. `TreatmentContext` is `{operator_id?}`, strict. The env var is `FEATURE_FLAGS_TABLE_NAME`; the table construct is `cdk/data/FeatureFlagsTable.ts`.
- Scheduler: `Nyc311OrderScheduling-<Env>` (cdk/lambda/Nyc311OrderSchedulingLambda.ts). It has no FeatureFlags grant today.
- Team Chat: one top-level post per card. On a re-park, reply in the existing thread.
