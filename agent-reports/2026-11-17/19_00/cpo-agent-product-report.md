# Product follow-up — Nov 17, 19:00

## Seth's mentions (2 tickets)

**#213 (WBR idle/fleet cost):** Seth approved Option A (additive `idle_stats`
CTE in `v1-wbr.sql`, flag-exempt as internal warehouse SQL, applied Test-then-
Prod by Seth with Rex's checks between). Re-approved CPO Approved on the
ticket and added the label; it stays in Intake pending Rex's re-approval
(pushback in Nov-14 had cleared both). Posted the go-ahead in its ticket
thread.

**#181 (intake poller stall):** Seth's comment read the fix as asking NYC's
feed to behave better, and suggested closing it as not possible. I replied on
the issue clarifying: the fix is entirely in our own poller logic
(`nyc311RequestService.ts` misreading a known, already-documented empty-page
quirk, #72, as "drained") — it needs nothing different from the external
feed, so "not possible" doesn't fit. The real open question is routing: Rex
recommended on 11-13 that this ship as a direct Pip bug fix rather than sit on
Kid Kestrel's board waiting on backend flag support. Tagged Rex in chat so the
routing call lands with him and Seth; left the ticket's problem/evidence/
metric as filed.

## Other open tickets

Checked #234, #166, #227, #170, #194 for new comments since my last look —
none found; no action needed on any.

## New contacts (3 triaged)

- **Dogwood** — real-time hazard detection system: declined (BoroughSim
  works from NYC 311 reports; no detection layer of our own to build).
  Pointed the "told when it's being worked" half to #166.
- **Yellowwood** — mark large potholes as urgent: declined (reports are
  already worked in order received; severity/size is assessed on site, not
  flaggable).
- **Sycamore** — subscribe to updates on specific orders: tracked on #166
  (status visibility).

## Board

No new Intake cards beyond #213/#181, both already handled above. No
backfill needed (prior runs cleared it).

## Queries

0/2 used — no number-dependent question from Rex or Seth this run.

## Memory

Updated with Seth's #213/#181 decisions and today's contact triage.
