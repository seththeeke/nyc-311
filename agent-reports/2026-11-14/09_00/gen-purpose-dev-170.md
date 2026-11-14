# Kid Kestrel: #170 Event-driven dispatch

**Card:** #170, Assigned → **Spec Created** (2026-11-14). Held 12 h before development.
**Spec:** `docs/kid-kestral/170-dispatch-the-next-order-the-moment-an-operator-frees-up-not-only-on-the-hourly-scheduling-run.md` (commit `282fd1c`).
**Ticket comment:** https://github.com/seththeeke/nyc-311/issues/170#issuecomment-6879356251

## What I did

- Checked the bar: the verification block is complete (Metric, Query, Target, Window, Guardrails, Flag, Dial-up), and the issue has both `cpo-approved` and `cto-approved`.
- Read `orderSchedulingService.ts`, `operatorDao.startTransit`, `EventSourcedDao.appendEvent`, `orderExecutionService.resolveOrder`, the scheduling Lambda and schedule constructs, and the order and operator event topics.
- Confirmed Rex's race: `foldProjection` doesn't re-check IDLE, and a cancelled transaction surfaces as `TerminalError`.
- Found that `resolveOrder` appends `ORDER_RESOLVED` *before* `completeWork` sets the operator to IDLE. The spec therefore triggers on the operator's `WORK_COMPLETED` (plus `WORK_ABORTED` and `OPERATOR_ADDED`) and on `ORDER_ACCEPTED`. I asked Celestine and Rex to confirm.
- Took the baselines with 3 warehouse queries (1 more failed on syntax).

## Verification plan and "before"

- **Deciding metric: match delay per dispatch.** It's the time from the later of (order accepted, operator freed) to `ORDER_SCHEDULED`. Nov 7-12: p50 27.4-38.7 min, avg 28.7-33.0 min, 0.6-4.5% within 2 min. Target: p50 under 2 min and at least 90% within 2 min, over 7 days at 100% `T1`.
- **Reported alongside it:**
  - job-end → next-start gap: p50 28-29 min on backlog days;
  - share of starts at :22: 100% every day, Nov 7-13;
  - idle share on backlog days: 18.7-20.2% (Nov 7-9). The backlog emptied every day from Nov 10, so the ticket's idle-share metric may have no qualifying days;
  - accept → scheduled p50: 2.70, 4.32 and 1.64 h (Nov 10-12).
- **Guardrails:**
  - double claims: 0 since Oct 1;
  - event-Lambda errors under 1%, and no throttles. No baseline: the AWS profile is missing;
  - median time to resolve: 173.72 h.

## Flag and legs

- **Flag:** `EVENT_DRIVEN_DISPATCH`. Under `C` the event is ignored. Under `T1` it runs `scheduleOrders`. Rows to create: Test `T1`, Prod `C`.
- **Leg 1:** fix the claim race in `startTransit` and `dispatchOneOrder`, with a concurrent test. No dependency.
- **Leg 2:** a new `Nyc311OrderSchedulingOnEvent` Lambda with SNS subscriptions, which reads the flag. Depends on #202, which is in Intake.

## Next

- The CEO creates the flag rows and configures the `nyc311-gen-purpose-dev` AWS profile.
- Celestine and Rex confirm the trigger-event change during the 12 h hold.
- #202 must ship before Leg 2.
