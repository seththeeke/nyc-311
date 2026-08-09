# sample-data

Static JSON fixtures for every entity in `docs/data-model.md`, used by the
mock backend (`src/mock/`) so `demo-frontend` runs entirely client-side with
no real API.

Referentially consistent: `Request -> Order -> Case`, `Operator <-> Shift`,
in-flight (`Execute`-stage) Orders are pre-matched to an Operator so the map
has trucks moving toward real incidents on first load.

Fields prefixed `_` on `operators.json` (`_position`, `_destination_location_id`,
`_depot`, `_assigned_order_id`, `_display_name`) are demo-only — not part of
the canonical `Operator` projection in `data-model.md` — consumed by the
mock backend's tracking-tick simulation to animate trucks on the map.

Regenerate with a fresh shuffle:

```
node generate-sample-data.mjs
```

## Scale knobs

`TOTAL_ORDERS`, `TOTAL_OPERATORS`, and `OFF_SHIFT_OPERATORS` at the top of
`generate-sample-data.mjs` control dataset size (currently 1000 / 50 / 6).
Orders split across workflow stages by `STAGE_WEIGHTS` — most end up
`Resolved` (history, no map pin); the rest are "in flight" and do render as
incidents. `Execute`'s share is sized close to on-duty operator capacity so
most Execute-stage Orders actually get matched to a truck rather than all
fighting over the same handful of operators. `Case` count scales off
`TOTAL_ORDERS` too (~10% of it, split across both queues), not 1:1 with
Orders — not every failure spawns a Case any more than in a real ops
platform.
