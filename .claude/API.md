# Public API — rules for changing it

Read this before touching anything under `backend/controller/web-api/publicV1/`,
`backend/service/publicApi/`, `backend/models/publicApi/`, or the
`Nyc311PublicApi` constructs in `cdk/api/`. The design is
`docs/16-resident-action-models.md` §2; this file is how to change it safely.

The public API is a contract with callers we don't control (residents today,
anyone tomorrow). The web-app's internal API (`api.boroughsim.com`) is not —
none of this applies there.

## 1. Spec first

1. Change `backend/controller/web-api/publicV1/openapi.yaml` first, with an example for every new request and response.
2. Then the `models/publicApi/` zod schemas, so the spec's examples parse.
3. Then the route list, controller, `publicApiService` and the domain call.

The parity tests (spec paths and methods equal `publicV1ApiRoutes.ts`; every spec example parses through its schema) fail until all three agree. Never weaken them to make a change pass.

## 2. Compatibility

- **Additive only within `/v1/`.** Allowed: a new route, a new optional request field, a new response field, a new `search_params` filter, a new enum value in a response the spec already says may grow.
- **Breaking (needs `/v2/`):** removing or renaming a field or route, making an optional request field required, changing a type or format, changing what an existing status value means, tightening a limit.
- Response fields are never removed to "clean up". Deprecate in the spec's `description` instead.

## 3. Shape conventions

- `snake_case` fields; `ALL_CAPS` enum values.
- `X-Requester` required on every route, format-checked only. `Idempotency-Key` optional on creating POSTs. `X-Call-Id` on every response.
- A single resource is returned bare; a list is `{ items, next_cursor }`, `limit` default 20, max 50.
- Errors are `{ error: { code, message, details? } }`, with codes from the fixed set in `models/publicApi/publicApiError.ts`. A 5xx never includes internal messages, stack traces or AWS error text.
- Public names describe what the caller does, not how BoroughSim stores it (feature requests, not contacts). Public status values come from a mapping table in `publicApiService`, never passed through from a domain enum.
- Never expose: SLA, priority, assigned operator, internal stage, retry counts, costs, case ids, `location_id`, BBL, coordinates, raw 311 payloads, submitter email, idempotency keys.

## 4. Layering

- Controller → `publicApiService` → domain service(s). Every public controller goes through `publicApiService`, even for a pass-through.
- `publicApiService` calls domain services only — never a DAO. If the domain service lacks a function, add it to the domain service.
- Domain code (`service/<domain>/`, `models/<entity>.ts`) never imports `models/publicApi/` or `service/publicApi/`.
- These are lint errors in `backend/eslint.config.js`; don't add `eslint-disable` to get around them.

## 5. Checklist (run before calling a public API change done)

- [ ] `openapi.yaml` updated, with examples; parity tests pass.
- [ ] The change is additive, or it's a new version.
- [ ] Request validation returns `VALIDATION_ERROR` with `details` per field.
- [ ] Nothing in §3's "never expose" list appears in a response.
- [ ] The usage row (`public_api_calls`) gets the right `operation`, `request_params` (filters only, no free text), `result_count` and `resource_id`.
- [ ] Throttle reviewed for any new route (`cdk/api/Nyc311PublicApi.ts`).
- [ ] Pipeline integration tests cover the new route or behaviour (`backend/tests/integration/publicApi/`).
- [ ] The customer side, if it calls the route, updates its own copied models in `customer/backend/models/` — it never imports BoroughSim's.
- [ ] `docs/16-resident-action-models.md` §2 updated.
