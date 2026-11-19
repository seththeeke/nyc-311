# CPO product report · 2026-11-19

## Cost per accepted order

- **Nov 16 week (4 days): $417** ($68,001 / 163 accepted). Down from $678 (Nov 9 week) and $2,093 (Nov 2 week).
- Labor $13,510 (20%), materials $54,491 (80%). Materials alone are ~$334 per accepted order, so the $25 goal stays out of reach (see 11-18 note to Seth).
- WBR labor counts only SCHEDULED→RESOLVED time. Idle paid time is not in it; #213 fixes that.

## WBR trends

- Accepted: 163 in 4 days (on pace for ~285; 501 the week before). Intake is still uneven (#181 open).
- Median resolution 7.9 h (7.4 h prior). That will rise: the backlog is growing.
- location_unresolved_rate 0.59 (0.56 prior). Execution failures: 0.
- Fleet: Brogan went 9 → 7 → 5 → 4 (Nov 16–18). On Nov 19 at 04:00 he reported 0 idle, a backlog of 58, and 89 accepted vs 41 resolved on Nov 18. He is holding at 4.

## Research: idle while work waits (proven, evidence added to #170)

Paid operator time by day (`operator_events`, deduped):

| Day | Ops | Work h | Drive h | Idle h |
|---|---|---|---|---|
| Nov 16 | 9 | 108.6 | 34.7 | 145.4 |
| Nov 17 | 5 | 31.1 | 9.0 | 23.6 |
| Nov 18 | 5 | 63.2 | 27.3 | 19.4 |
| Nov 19 (partial) | 4 | 25.8 | 10.6 | 10.2 |

Idle share fell from ~50% to ~22% with the fleet cuts. What is left is mostly a product problem:

- Since Nov 17: 73 idle gaps, median 27.7 min, p90 58 min. Only 2 were under 2 min, and 72 of 73 end in a dispatch.
- 69 of 73 gaps started with accepted orders waiting (median 48). That's **37.6 idle hours with work in the queue**, ≈ $1,800 of paid time.
- Cause: scheduling runs on `rate(1 hour)` (`Nyc311OrderSchedulingSchedule`). An operator who frees up mid-hour waits for the next run.
- Those hours are worth ~16 more jobs, **+22% throughput** on the same 4–5 operators, while the backlog is growing.
- This is #170 (Spec Created). I commented with the numbers and asked for priority. No new ticket.

Driving is ~21–25% of paid time (30–39 min per trip); that's #194.

## Contacts (3 triaged)

- 01M7SFQ0G1G0XEX4FX1HWAFF4F: tracked → #227 (post-repair feedback)
- 01M7SRTKAGJJ4BGZM9KQYQY8EV: declined (mark potholes urgent)
- 01M7RV3V1E9PVNP3DXWAV6SCMG: declined (resident-set priority)

## Tickets

- None new.
- Updated #170 (idle-with-backlog evidence) and #227 (+1 contact).
- No Seth mentions newer than my replies. Inbox empty.

## Board

- Intake: #181 and #244. Both are cpo-approved, and neither is a board-routed feature, so there's nothing to move.
- No new cards. Backfill is complete.

## Queries: 3/10 used

1. fleet-time-budget-daily (8 days)
2. idle-gap-cadence (gap length, ending in transit)
3. idle-with-backlog (new)

Saved-query folder writes are still blocked (sensitive file). The query shapes are kept in MEMORY.md.
