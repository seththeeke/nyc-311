# Admin Auth Integration — Design & Build Doc

**Status: Shipped and verified live 2026-09-10.** Deployed to both
`Nyc311-Test` and `Nyc311-Prod`; the real admin account logs in
successfully at both `test.boroughsim.com` and `boroughsim.com`, including
the `NEW_PASSWORD_REQUIRED` first-login flow. See the Build Checklist at
the bottom for the full list of what shipped.

> Leg 0 of the capacity-management effort (see `10-capacity-modeling-and-integration.md`
> for Legs 1-4). Building this first, in isolation, so the authenticated-admin
> tier already exists as reusable infrastructure by the time capacity
> management needs its first mutating, admin-only endpoint.
>
> Closes the gap between `claude-prompt-initial.md` §5/§7 (Cognito for the
> single Admin user — already decided, not re-litigated here) and today's
> reality: `web-app/routes/` only has a `PublicRoute` guard, no admin route
> tier exists, no API Gateway route requires auth, and `User`
> (`data-model.md#user`) has never been built.
>
> Negotiated **question by question**, same progressive style as
> `5-order-evaluation.md`/`6-order-scheduling.md`.

---

## Decision Status

| Topic | Status |
|---|---|
| [1. Admin account provisioning](#1-admin-account-provisioning) | **Agreed (2026-09-10)** |
| [2. Cognito User Pool configuration](#2-cognito-user-pool-configuration) | **Agreed (2026-09-10)** |
| [3. Frontend auth integration](#3-frontend-auth-integration) | **Agreed (2026-09-10)** |
| [4. API Gateway authorization](#4-api-gateway-authorization) | **Agreed (2026-09-10)** |
| [5. `User` persistence & audit attribution](#5-user-persistence--audit-attribution) | **Agreed (2026-09-10)** |
| [6. In-memory/mock mode behavior](#6-in-memorymock-mode-behavior) | **Agreed (2026-09-10)** |
| [7. Local dev workflow](#7-local-dev-workflow) | **Agreed (2026-09-10)** |
| [8. Testing](#8-testing) | **Agreed (2026-09-10) — fully built and verified live** |
| [9. CDK construct shape & naming](#9-cdk-construct-shape--naming) | **Agreed (2026-09-10) — built as proposed** |

---

## 1. Admin account provisioning

**Agreed.** Self-signup is disabled entirely on the Cognito User Pool
(`AdminCreateUser` is the only way an account is ever created — no public
sign-up flow, matching the "single authenticated admin" framing in
`claude-prompt-initial.md` §5). The one admin account per environment is
created via a one-time, manual

```
aws cognito-idp admin-create-user --profile nyc311 --user-pool-id <id> --username <email> ...
```

run once against `Nyc311-Test` and once against `Nyc311-Prod` after each
environment's first deploy of this leg — a mutating AWS CLI call, so it
goes through `CLAUDE.md` §3's Deploy Safety Gate like any other. Never
scripted into the pipeline or committed anywhere; the admin's email/temp
password never appear in CDK code or stack parameters.

---

## 2. Cognito User Pool configuration

**Agreed.** One User Pool **per environment** (`Nyc311AdminPool-Test`,
`Nyc311AdminPool-Prod`), each with its own single admin user — consistent
with `CLAUDE.md` §5.3's per-environment physical-naming rule (same reason
`Orders`/`Requests`/`Locations` tables are already suffixed).

- Standard Cognito password policy (min length 8, upper/lower/number/symbol
  required) — no unusual hardening needed for a single-user pool.
- **SRP auth flow** (`ALLOW_USER_SRP_AUTH`), which is what Amplify Auth
  uses by default — password itself never crosses the wire. The app
  client also enables `ALLOW_USER_PASSWORD_AUTH` — used *only* by the
  integration suite's server-side test-admin sign-in (§8), which has no
  SRP-capable library in `backend/`'s dependency set. The browser/Amplify
  login path never uses it.
- **Forced password change on first login** — `AdminCreateUser` sets a
  temporary password; Cognito requires it to be changed before the session
  is usable.
- **No MFA for v1** — named explicitly as a simplification, not an
  oversight: single admin, portfolio-scale project. Revisit if this ever
  protects something with real stakes.
- **One app client**, no client secret (a browser SPA can't keep a secret
  confidential — same reasoning API Gateway's own docs give for public
  clients), `Nyc311AdminPoolClient-${suffix}`.

---

## 3. Frontend auth integration

**Agreed.** Full **AWS Amplify** (`aws-amplify` v6, `Auth` category), a
**custom login form** (not Hosted UI) so the admin never leaves
`boroughsim.com`/`test.boroughsim.com`, using **Amplify's own token
cache** (default browser storage) rather than hand-rolling one.

Layered per `CLAUDE.md` §5.1's existing service/hook/component split:

- `web-app/services/authService.ts` — one interface, two implementations
  (real Amplify-backed / in-memory mock), selected by `config.ts`'s
  `mock`/`live` flag, exactly like every other service. Wraps
  `Amplify.configure`, `signIn`, `confirmSignIn`, `signOut`,
  `fetchAuthSession`. **`signIn` handles Cognito's
  `CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED` challenge** — the state a
  plain `AdminCreateUser` (§1's real-admin provisioning path) leaves an
  account in — returning `{status: "NEW_PASSWORD_REQUIRED"}` instead of
  throwing; `completeNewPassword(newPassword)` finishes it via
  `confirmSignIn`. Found and fixed 2026-09-10, before the real admin
  account was created: without this, a temp-password account would have
  been unable to log in through our own `LoginPage` at all.
- `web-app/hooks/useAuth.ts` — exposes current auth state (logged
  in/out, the current `User`) to components; components never call
  `authService` directly.
- `web-app/models/user.ts` — TS type + zod schema mirroring
  `data-model.md#user`'s admin-relevant fields (`user_id`, `email`,
  `display_name`), consumed by the service layer the same as every other
  model.
- `web-app/components/pages/LoginPage.tsx` — the custom login form, with a
  second stage (new-password form) rendered when `signIn` returns
  `NEW_PASSWORD_REQUIRED`.
- `web-app/routes/AdminRoute.tsx` — the second visibility-tier guard
  `CLAUDE.md` §5.1 already called for (alongside the existing
  `PublicRoute`): redirects to `/login` when `useAuth` reports logged out.

---

## 4. API Gateway authorization

**Agreed.** Native HTTP API **JWT authorizer**
(`aws-cdk-lib/aws-apigatewayv2-authorizers`' `HttpJwtAuthorizer`), configured
against the environment's Cognito User Pool issuer + app client id as
audience — API Gateway validates the token before the route's Lambda ever
runs, no custom authorizer Lambda needed.

Attached **only** to admin-mutating routes added from this leg forward
(Leg 2's capacity add/remove, plus this leg's own verification route, §8)
and any future admin-only route. Every existing GET route
(`/ingestion/metrics`, `/orders`, `/order-events`, `/lambda-metrics`,
`/data/*`, `/reports`, `/pipeline/status`) stays exactly as it is today —
public, unauthenticated.

---

## 5. `User` persistence & audit attribution

**Agreed.** Build the `Users` table now, per `data-model.md#user` and
`ddb-design.md`'s already-designed schema — `Users-${suffix}`, `PK =
user_id`, no GSIs (single-item `GetItem`/conditional `PutItem` access
pattern only, same shape as `Locations`). `User` is a plain record, not
event-sourced.

- `backend/dao/user/userDao.ts` — plain `Dao<User>` (per `CLAUDE.md`
  §5.2's DAO-shape split), lazily constructed per the project's
  no-module-scope-singleton rule.
- `backend/service/user/userService.ts` — `getOrCreateUser(cognito_sub,
  email)`: looks up by a new sparse GSI on `cognito_sub` (the JWT's `sub`
  claim, not `user_id`, is what's available at request time) or creates a
  new `User` row (`user_id` a fresh ULID, `type: "ADMIN"`, `status:
  "ACTIVE"`), then bumps `last_active_at`.
- **Shared controller helper** — `requireAdminUser(event)` in
  `backend/controller/`, the first thing every admin-only controller calls
  (matching the project's "parse/validate first" convention): extracts
  `cognito_sub`/`email` from `event.requestContext.authorizer.jwt.claims`,
  calls `userService.getOrCreateUser`, returns the `User` for the
  controller to use as `actor` context. Written once, reused by every
  admin controller rather than duplicated.

---

## 6. In-memory/mock mode behavior

**Agreed.** Mock mode still renders the real `LoginPage` (exercises the
login UI in dev/tests), but `authService`'s mock implementation validates
against a **fixed in-memory mock credential** (a constant in
`web-app/test-data/`) instead of calling Cognito — no network call, no
real account needed. A successful mock sign-in sets an in-memory "logged
in" flag `useAuth` reads, same lifecycle as every other mock service call.

---

## 7. Local dev workflow

**Proposed.** In mock mode (the existing default for local
`npm run dev`), §6's fake login is all that's needed — no real Cognito
touch for day-to-day frontend work. In live mode, `npm run dev` points at
`Nyc311-Test`'s real User Pool/API and you log in with the real admin
credential from §1, same flow as production. The one open wrinkle: the
integration suite's `local` target (`sam local start-api`,
`4-pipeline-integration-tests.md`) will need a real or test Cognito token
to exercise the new authorizer-protected route from §8 even when running
against `local` — left as a build-time detail to work out in that suite's
existing token-fetch step, not a fresh design decision.

---

## 8. Testing

**Agreed.** The existing pipeline gate (`backend/tests/integration/`,
GET-only today) stays **GET/read-only in scope** — no capacity-mutating
route ever runs automatically on every deploy. But **auth plumbing itself
gets one automatic integration test**, so a broken authorizer/User-table
wiring is caught on every deploy rather than only when someone happens to
click through the UI:

- **New route**: `GET /admin/whoami` — admin-authorized, returns the
  caller's `User` record (`userService.getOrCreateUser` under the hood).
  Exists purely to prove the JWT authorizer + `Users` table works
  end-to-end; not otherwise useful to the frontend today.
- A **dedicated test-admin Cognito user** — `test-scripts/6-setup-test-admin.py`
  provisions it fully programmatically, no console step ever: looks up
  `Nyc311AdminUserPoolId` (a new `CfnOutput` on `Nyc311Stack`, same
  lookup-by-stack-output pattern `apiUrlOutput` already establishes),
  `AdminCreateUser` (idempotent — tolerates `UsernameExistsException` on a
  re-run), then `AdminSetUserPassword --permanent` with a freshly
  generated password. `--permanent` is what makes this fully
  non-interactive: it sets the password directly and marks the user
  `CONFIRMED`, skipping the `FORCE_CHANGE_PASSWORD` challenge a normal
  sign-up would otherwise leave pending. The credential is then written to
  a per-environment **Secrets Manager** secret
  (`Nyc311AdminTestCredential-<suffix>`). Run once per environment
  (`--prod` flag, same convention as `5-warehouse-rebuild.py`) — a
  mutating AWS action, so `CLAUDE.md` §3's Deploy Safety Gate applies.
  The integration suite fetches that secret and signs in via Cognito's
  `InitiateAuth` (`USER_PASSWORD_AUTH`, not SRP — the app client gets a
  second auth flow enabled specifically so a server-side test harness
  doesn't need an SRP-capable library; the browser/Amplify path still uses
  SRP exclusively, per §2/§3) to get a token, then calls `/admin/whoami`
  with it — plus one test asserting a **401** with no token at all.
- **Everything else stays manual**: capacity add/remove (Leg 2) gets its
  own on-demand `test-scripts/`-style script when it ships, not a pipeline
  gate entry — deliberately, so deploys never mutate real capacity rows in
  Test/Prod as a side effect.
- **Unit tests (Vitest, 90% per-file):** `authService` (mocked Amplify),
  `useAuth`, `AdminRoute`/`LoginPage` (RTL), `UserDao`/`userService`
  (`aws-sdk-client-mock`), the `requireAdminUser` controller helper,
  `whoamiController`.
- **CDK assertions:** the User Pool (self-signup disabled, no MFA, SRP
  only), the app client (no secret), the `Users` table + GSI, the JWT
  authorizer's issuer/audience config, and that it's attached to
  `/admin/whoami` but **not** to any existing GET route.

---

## 9. CDK construct shape & naming

**Proposed.** New `cdk/auth/Nyc311AdminAuth.ts` (User Pool + app client +
JWT authorizer, one construct — mirrors the "one custom construct per
resource, instantiated from the main stack" rule in `CLAUDE.md` §5.3),
added as a one-line addition to that section's directory listing rather
than a new top-level unlock (same kind of incremental addition
`cdk/warehouse` was for data-warehousing). `Users-${suffix}` table lives
in `cdk/data/UsersTable.ts`, matching every other table's file/naming
convention (`ENV_NAME_SUFFIX`, `RemovalPolicy.RETAIN`, PITR on).

---

## Build Checklist

Code built and locally verified 2026-09-10 (build/lint/test/coverage green
across `backend`, `cdk`, `web-app`); live `Nyc311-Test` deploy/verification
and the Secrets Manager/integration-test piece are still pending.

- [x] `docs/data-model.md` — no changes needed (`User` already fully specified).
- [x] `docs/ddb-design.md` — no changes needed (`Users` table already fully specified).
- [x] `CLAUDE.md` §5.3 — one-line addition noting `cdk/auth/`.
- [x] `cdk/data/UsersTable.ts`.
- [x] `cdk/auth/Nyc311AdminAuth.ts` (User Pool, app client, JWT authorizer).
- [x] Wired the authorizer onto `cdk/api/Nyc311Api.ts`'s `/admin/whoami` (no other route yet — future admin routes attach the same `adminAuthorizer` prop).
- [x] `backend/models/user.ts`.
- [x] `backend/dao/user/userDao.ts`.
- [x] `backend/service/user/userService.ts`.
- [x] `backend/controller/web-api/requireAdminUser.ts` (shared helper) + `whoamiController.ts`.
- [x] `web-app/models/user.ts`.
- [x] `web-app/services/authService.ts` (real + mock, `aws-amplify` added as a dependency).
- [x] `web-app/hooks/useAuth.ts`.
- [x] `web-app/routes/AdminRoute.tsx`.
- [x] `web-app/components/pages/LoginPage.tsx`.
- [x] `web-app/components/pages/AdminPage.tsx` — a minimal placeholder wired at `/admin` so `AdminRoute` protects something real end-to-end; `10-capacity-modeling-and-integration.md` §2.2 replaces its content with the tile-grid Admin page.
- [x] `web-app/test-data/adminUser.ts` — mock admin credential + `User`.
- [x] `cdk/web/WebsiteDeployment.ts` / `Nyc311Stack.ts` — `userPoolId`/`userPoolClientId` added to the runtime `env-config.json` injection, same mechanism as `apiBaseUrl`.
- [x] `cdk/stack/Nyc311Stack.ts` — `Nyc311AdminUserPoolId`/`Nyc311AdminUserPoolClientId` `CfnOutput`s.
- [x] `test-scripts/6-setup-test-admin.py` — programmatic test-admin provisioning (§8).
- [x] `Nyc311AdminAuth.ts` — enabled `ALLOW_USER_PASSWORD_AUTH` alongside SRP on the app client (§2/§8).
- [x] `backend/tests/integration/support/cfnOutputs.ts` — shared stack-output lookup, factored out of `targets.ts`.
- [x] `backend/tests/integration/support/testAdminAuth.ts` — resolves the Secrets Manager credential + `InitiateAuth` helper.
- [x] `backend/tests/integration/adminWhoamiApi.integration.test.ts` — 200 with token, 401 without; skipped for `INTEGRATION_TARGET=local` (SAM's local API Gateway emulation doesn't enforce JWT authorizers).
- [x] `/admin/whoami` added to `routeTracker.ts`'s `KNOWN_ROUTES` — shows up in the existing route-hit report/Monitoring tile like every other tracked route.
- [x] `cdk/stack/Nyc311Stack.ts`/`Nyc311AppStage.ts` — `adminUserPoolClientIdOutput` exposed the same way `apiUrlOutput` already is.
- [x] `cdk/pipeline/Nyc311IntegrationTestStep.ts` — `USER_POOL_CLIENT_ID` threaded via `envFromCfnOutputs`; `secretsmanager:GetSecretValue` (scoped to `Nyc311AdminTestCredential-<env>-*`) and `cognito-idp:InitiateAuth` (scoped to account/region — User Pool ids aren't deterministic pre-deploy) granted on the step's role.
- [x] Unit tests + CDK assertion tests, 90%+ per file, `backend`/`cdk`/`web-app` all green.
- [x] Deployed to `Nyc311-Test` (via the pipeline, 2026-09-10).
- [x] Ran `test-scripts/6-setup-test-admin.py` against `Nyc311-Test` — test-admin user + `Nyc311AdminTestCredential-Test` secret created.
- [x] Verified live: signed in as the test-admin via `InitiateAuth` and confirmed `GET /admin/whoami` — `200` with the token (correct `User` record), `401` with none.
- [x] Found and fixed a real gap before creating the real admin: `authService`/`LoginPage` had no handling for Cognito's `NEW_PASSWORD_REQUIRED` challenge — a plain `AdminCreateUser` account would have been unable to log in through our own form at all (§3).
- [x] Deployed to `Nyc311-Prod` (via the pipeline, 2026-09-10 — the first time Prod received any of Leg 0's infrastructure, since the earlier failed `IntegrationTestsTest` had blocked `DeployProd` from running at all until this batch, fix included).
- [x] Ran `test-scripts/6-setup-test-admin.py --prod` against `Nyc311-Prod` — test-admin user + `Nyc311AdminTestCredential-Prod` secret created (`IntegrationTestsProd` is non-blocking/always-exits-0, so it had been silently no-op'ing rather than actually verifying anything until this ran).
- [x] One-time `admin-create-user` for the real admin (seththeeke@gmail.com), both environments — temporary password, `FORCE_CHANGE_PASSWORD` state, so the new §3 challenge-handling gets exercised on first real login.
- [x] Verified live in `Nyc311-Test`: real-admin login at `test.boroughsim.com` — temporary password accepted, `NEW_PASSWORD_REQUIRED` correctly triggered the new-password form, real password set successfully.
- [x] Verified live in `Nyc311-Prod`: same real-admin login flow confirmed working at `boroughsim.com`.

**Leg 0 (admin auth) is complete — built, deployed, and verified live end-to-end in both `Nyc311-Test` and `Nyc311-Prod` as of 2026-09-10.**
