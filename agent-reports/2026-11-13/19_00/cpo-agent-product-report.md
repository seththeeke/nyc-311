# Product report — conversation, Nov 13 19:00

## Seth's mention — #166 rework

Seth tagged me and Rex on #166 ("Notify residents when their order is
scheduled"), rejecting the proposal to add `ORDER_SCHEDULED` to the
webhook/push event stream: that stream exists only to populate the
customer stack's own eligible-order record, not as a resident-facing
notification channel, and real integrators wouldn't subscribe to push
without a text/email hook anyway. He asked for another way to resolve the
underlying resident request.

I withdrew the webhook proposal and rewrote the ticket as a pull-based
fix: the public API's `POST /v1/requests/search` already returns `status:
SCHEDULED` and `scheduled_window` once `orderDao.scheduleOrder` runs
(`backend/service/publicApi/publicApiService.ts`) — nothing is missing on
BoroughSim's side. The gap is that a resident only sees it when their own
simulated model happens to spend one of its three `SEARCH_REQUESTS`
actions (`customer/backend/service/action/actionTools.ts`) on that order.
The new proposal has `gatherIdeaContext`
(`customer/backend/service/idea/ideaContext.ts`) proactively call the same
endpoint for followed orders and write the same `ORDER_CHECKED` thread
update, before building context — no new event type, no subscription, no
push. Same success metric (resident searches per resolved order, 58
baseline, -30% target) and dial-up (`C`→100%), since the resident-facing
outcome is unchanged.

Removed the `cpo-approved` label since the mechanism changed, and asked
Rex a feasibility question on call volume (one search call per followed
order per idea-context cycle vs. a batch-status endpoint) before
re-approving. Updated the issue body, posted a GitHub comment, and a
thread reply in `#executive-team`. Seth had moved the card back to Intake
by hand; no further board action needed from me this run.

## Other open tickets

Checked #170, #181, #194, #213, #69, #202: no new comments requiring a
reply since my last look. #202 (not mine) has Kestrel parked on an
AWS-profile setup blocker — a human/ops decision, outside my role.

## Contacts

No new `RECEIVED` contacts (checked two pages, both empty).

## Research agenda

No movement this run — #166's revision is itself a small step toward the
"resident satisfaction has no direct data" idea: it narrows the gap
between a resident being told something and having to spend a scarce
action to find out. Intake stall (#181) and idle-share tracking not
re-checked (0/2 queries spent on code reading and ticket work instead).

## Queries

0/2 used — the fix for #166 came from reading
`backend/service/publicApi/publicApiService.ts`,
`customer/backend/service/action/actionTools.ts`, `ideaContext.ts` and
`residentIdea.ts`, not warehouse data.

## Memory

Updated: #166's revised status, the board note that Seth moved it by hand,
a new lesson about Seth's un-marked comments vs. the Rex-reply cap, and
this run's log line.

Chat post: none (reply only, in #166's existing thread:
01M7BSBH7DZ7CSHDZRT099YPVZ)
