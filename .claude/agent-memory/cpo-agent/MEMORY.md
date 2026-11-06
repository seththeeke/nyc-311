# Celestine's memory (cpo-agent)

Public: committed to the repo after any run that changes it. Conclusions from
past runs only, never secrets. Hard cap 8 KB; prune the oldest or least useful
lines to stay under it. See docs/17-executive-team.md §17.6.

## Tickets filed (issue, what, contacts merged into it)

- **#166 (2026-11-06, feature-request):** Add `ORDER_SCHEDULED` to
  `WEBHOOK_EVENT_TYPES` (today only `ORDER_ACCEPTED`/`ORDER_RESOLVED` fire —
  `backend/models/webhookSubscription.ts`) so residents get a proactive
  notice when their repair is scheduled, not just accepted/resolved. Open
  question left for Rex: webhook fan-out vs. a pull-only public API
  addition. Merged 18 contacts (12 push/notification-themed + 6
  dashboard/map/filter/history-themed — same underlying "status visibility"
  need, different form). If more status-visibility contacts arrive, add
  them to #166 as a comment, don't file a new issue.

## Contacts declined and why

- **Data export/analytics/"open API" asks (Ginkgo mostly, some Sassafras):**
  already served — `POST /v1/requests/search` on the public API
  (`public-api.boroughsim.com/v1`) returns per-request status, scheduled
  window and timestamps with no auth. Crew/operator performance data is
  *deliberately* excluded from the public API by design
  (`backend/models/publicApi/serviceRequest.ts` comment: "Never carries
  SLA, priority, operator, stage, costs or coordinates") — decline any
  future ask for crew/operator-level exports on that basis, don't re-litigate.
- **Hazard-flagging / direct resident reporting (Dogwood mostly, also
  Yellowwood/Sassafras/Hornbeam):** out of scope by architecture — BoroughSim
  only ingests Requests from NYC 311's own SODA feed
  (`backend/controller/ingestion/`); there is no resident-submission path
  and the public API has no "create a request" route (only
  `requests/search`, `feature-requests`). Any future ask for an in-app
  hazard/photo/incident reporting tool should decline the same way.
- **Self-service mark-complete / feedback / follow-up scheduling
  (Sassafras):** declined — completion is crew-verified for data
  integrity, and follow-ups are already auto-scheduled by dispatch
  (SLA-ordered, `backend/service/scheduling/orderSchedulingService.ts`).
- **Single-order escalations (Hawthorn, Hornbeam) and physical-maintenance
  cadence asks (crosswalk repainting, Yellowwood):** not generalizable
  product features; declined with a pointer to the active fleet expansion
  (see WBR trend below) rather than a ticket.

## WBR trends worth remembering

- **2026-11-06 run:** a resolution-time crisis has been underway since
  ~Oct 19: 7-day median time to resolve climbed 6.2d (Oct 20) → 13.4d peak
  (Nov 1), still ~11d and falling as of Nov 6. Brogan grew the fleet 5→17
  operators over Oct 31–Nov 6 (capped at 2 recruits/day, repeatedly asking
  Seth to raise the cap) and burn rose $225/h→$765/h. Backlog still ~580
  orders (Nov 6), oldest order 10 days stale. WBR has no explicit
  `cost_per_order` column — I approximated it as
  `total_cost / orders_created` (labor+materials over ALL complaints
  created, not just street-condition ones; `rejected_service_not_supported`
  is consistently ~96-98% of `orders_created` every week — a stable
  structural ratio, not a new problem). That ratio sat ~$4-5/order every
  full week since early Oct, but is tracking ~$30 for the still-partial
  week of Nov 2 — watch next run whether that holds once the week closes
  or was a partial-week artifact (orders_created for that week looked
  anomalously low/lagged across consecutive daily runs, possibly an
  ingestion-lag quirk, not a confirmed real demand drop).
- `orders_accepted`/`orders_resolved` as a cost-per-order denominator gives
  $300-600/order — implausible against the $25 target, so `orders_created`
  (the blended/all-complaints denominator) is almost certainly the right
  read of `business-insights.md`'s "`period_platform_cost / orders_in_period`".

## Lessons

- Contacts cluster heavily by persona repeating near-identical asks every
  1-3 days (Dogwood, Sassafras, Ginkgo, Juniper, Yellowwood all did this
  2026-10-31→11-06). Group by underlying need, not by title wording, before
  counting "how many residents asked."
- Push notifications and status dashboards/maps are the same underlying
  resident need (visibility into order status) in two different UI forms —
  fine to merge into one ticket.
- The "satisfaction" KPI likely traces to `customer/backend/models/residentIdea.ts`'s
  `ResolutionStatus` (`SATISFIED`/`UNSATISFIED`/`GAVE_UP`/`MAX_DEPTH_REACHED`)
  on each resident idea — repeated identical feature requests from the same
  persona are a plausible proxy for ideas ending un-satisfied.
