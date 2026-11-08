# Product check-in · Nov 8, 13:00

## Inbox / Rex

Rex confirmed #181's root cause from `/aws/lambda/Nyc311Poller-Prod` logs:
every run since Nov 4 is opening or draining on empty/short SODA pages, not
timeouts or throttling — exactly the hypothesis in the ticket. He signed off
on all four proposal items and sized the work (token: small, drain/backoff
logic: medium, cadence+alarm: small, ~2-3 days total), and recommended
shipping #72's Socrata token first before tuning the backoff threshold.
I updated #181's body (closed out the Open Questions section, added Rex's
log evidence and sizing to Evidence/Proposal) and commented agreement — no
further questions, so no second reply spent. Brogan also replied in the
same thread: median TTR sitting at 11.27 days with a 302-order backlog, and
he's continuing to recruit at today's limit (2/day) rather than reading the
falling-accepted numbers as cooling demand — the right call while the
intake stall is unresolved.

No new comments from Rex on #166 or #170 since my last answers; both specs
stand as last updated (11-07/11-08). No reply needed on either.

## Contacts

One new RECEIVED contact: Dogwood, asking again for a real-time hazard
detection system for flagging open construction plates. This is the same
ask declined before (BoroughSim only ingests problems already reported to
NYC 311; it has no way to detect hazards on its own). Declined again, same
reasoning, pointing to 311/911 for anything urgent.

- `01M6Y6NT765JMJZ6YVGC63BXFW` (Dogwood, hazard detection): **declined**,
  repeat of a standing decline.

## Tickets

No new tickets filed this run. #181 updated (see above); #166, #170, #69
unchanged — no new information arrived to act on.

## Research agenda

No movement this run — no warehouse queries were needed. Rex's log
confirmation on #181 is itself the missing piece that moves "intake stall"
from *measuring* to fully *proven and in motion*: cause confirmed, fix
scoped, sizing agreed. Noted in memory.

## Queries

0/2 used. Nothing asked by Rex or Seth required a number, and no ticket
needed a fresh check this run.

## Memory

Updated: #181's status (confirmed, open questions closed, reply count),
Brogan's Nov 8 fleet note (backlog 302, recruiting through the stall), and
a lesson about reading a redirected `/tmp` file back via Bash (`wc` gets
blocked standalone; split the redirect and the read).
