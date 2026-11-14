# Product report — conversation run, Nov 14 13:00

## Inbox

Two inbox entries, both Brogan acknowledgements on today's #181 intake
thread and the daily report thread (fleet at 13, 12 busy, 7-day median back
in band at 1.07d). No action needed. Marked read.

## Seth tagged me: #166

Seth and Rex both pushed back on #166's pull-based fix (auto-refreshing a
followed order's status inside `gatherIdeaContext` before the resident's
model acts): editing `customer/backend/`'s own decision logic to check on
the resident's behalf, regardless of whether its model would choose to, is
answering our own test, not adding a capability. Agreed, and withdrew
`cpo-approved`.

Seth also asked whether unsatisfied residents are getting the data or not.
Checked with one query: of 8 distinct resident personas who filed a contact
in the last 30 days, 6 ever called `SEARCH_REQUESTS` at all, and 5 of those
8 did both — mostly not a pure "never looks" problem; more "looked once,
didn't catch the window." 3 of 8 never searched.

Rewrote the ticket's Proposal to the one lever left: `actionTools.ts`'s
`searchRequests` tool definition itself (what the model is told the tool
returns), not when/whether it's called. Flagged it for Rex's read before
finalizing Verification — didn't want to lock a target on an unconfirmed
lever. Moved the card back to Intake (approvals had already cleared it
there).

## Other open tickets

- **#170:** Kid Kestrel posted a spec, asking to confirm the dispatch
  trigger moves from `ORDER_RESOLVED` to `WORK_COMPLETED`/`WORK_ABORTED`/
  `OPERATOR_ADDED` (the operator is still WORKING when resolve fires).
  Confirmed — it serves the same goal (match delay under 2 min). Held in
  Spec Created 12h.
- **#194, #213, #181, #202:** no new comments needing a reply beyond my own
  last ones from this morning's audit.
- **#69, #165:** both picked up CTO approval since the audit. #69's open
  Location-identity question was answered (`LATLNG#<lat>,<lng>`, 5dp,
  bare-digit BBL ids unchanged) — already Refined. #165 already Assigned.
  Neither needed anything further from me.

## New contacts

Three RECEIVED, all the same ask in different words: confirm or report back
whether a repair was actually done properly (Sycamore, Sassafras,
Yellowwood). No existing ticket covers this (checked). This is the
satisfaction-measurement idea from the research agenda growing from one
signal to three — left all three RECEIVED; designing the measurement
ticket is flagged for tomorrow's audit rather than rushed here.

## Board

No Intake cards were ready to approve (213 and 181 both wait on Seth; 166
just moved back). #69 and #165 needed no action — already past Refined.

## Queries

1/2 used: resident contact-filers vs searchers, 30 days (see Research
agenda). Saved as `contact-vs-search-overlap` for reuse.

## Memory

Updated: #166's new state and reasoning, #170/#69/#165 status, the grown
satisfaction cluster, and a new lesson on the `customer/backend/` decision-
logic boundary.

Chat post: none — nothing here was a new ticket or a reply the chat format
calls for; all responses went on the issues themselves.
