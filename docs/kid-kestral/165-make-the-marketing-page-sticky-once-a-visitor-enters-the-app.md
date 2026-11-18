# 165. Make the marketing page sticky once a visitor enters the app

**Status:** Spec created 2026-11-14; CEO-approved; development started 2026-11-15; Leg 1 merged 2026-11-18. **Ticket:** #165. **Card:** In Development.

## 1. Ticket

With `MARKETING_PAGE` on `T1`, `/` shows the full-screen marketing page until
the visitor clicks Enter fleet. `MarketingGate.tsx` remembers that click in
`sessionStorage` (`nyc311.marketing.entered`), which is per tab, so every new
tab and every new browser session lands on the marketing page again.

This project remembers the entry in `localStorage` with a timestamp, refreshes
the timestamp on each visit, and shows the marketing page again once the entry
is more than 7 days old. A button in the About drawer clears the entry and
returns the visitor to the marketing page. All of it sits behind a new flag,
`MARKETING_STICKY_ENTRY`.

## 2. Verification

**The ticket's block** (Celestine's `cpo-agent:metric` comment, 2026-11-14) is
a direct browser check. No page-view analytics exist, so there is no metric to
baseline. Six steps, as a Playwright spec run by `BrowserSmokeTestsTest`, plus
one manual pass:

| # | Step | Expected on `T1` | Today (before) |
|---|---|---|---|
| 1 | Fresh context → `/` | marketing page | marketing page (pass) |
| 2 | Click Enter fleet | map shell | map shell (pass) |
| 3 | New page, same context → `/` | map | **marketing page** (fail: `sessionStorage` is per tab) |
| 4 | New context with step 2's `storageState` → `/` | map | **marketing page** (fail) |
| 5 | Entry seeded 8 days old → `/` | marketing page, entry removed | not possible today (no timestamp) |
| 6 | About → "Back to the intro" | marketing page at `/`, entry removed | **no such button** |

The "before" comes from the code on `origin/main` (`readEntered`/`writeEntered`
use `sessionStorage` only) and the existing unit test "goes straight to the map
for a visitor who already entered this session".

**What I add:**

- **V1, the deciding check: the smoke spec** `web-app/tests/smoke/marketingEntry.spec.ts`,
  steps 1–6 against Test, where both flags are `T1`. It passes on two pipeline
  runs before Prod moves. In Prod I run the same steps by hand
  (`SMOKE_BASE_URL=https://boroughsim.com npm run test:smoke -- marketingEntry`)
  right after the flip and again 24 h later. Steps 1–4 and 6 must pass. Step 5
  also runs in Prod because it seeds its own state.
- **V2, unit tests for both treatments** (`tests/routes/MarketingGate.test.tsx`,
  `tests/routes/marketingEntry.test.ts`, the About drawer test). `C` stays
  byte-for-byte today's behavior: `sessionStorage` only, no button, no
  `localStorage` read or write. `T1` covers persisted entry, the refresh, the
  7-day expiry at 7 d ± 1 min, blocked storage, a malformed stored value
  (treated as not entered and removed), and clearing through the button.
- **V3, the flag read in Prod:** `get_flag MARKETING_STICKY_ENTRY` returns
  `C`, then `T1` after the flip. Before (2026-11-14): `404 No feature flag
  MARKETING_STICKY_ENTRY`.

**Guardrails:**

- `map.spec.ts` and every other smoke test stay green. It seeds
  `sessionStorage` today. Leg 1 seeds both stores, and `T1` still honors the
  `sessionStorage` key for the current tab.
- Every non-`/` path passes straight through to the shell under any
  treatment (the existing unit test, kept).
- With `MARKETING_STICKY_ENTRY` at `C`, `/` behaves exactly as today. With
  `MARKETING_PAGE` at `C`, nothing in this project shows: no marketing page and
  no button.
- Before: I couldn't read the pipeline's latest smoke result because the AWS
  profile `nyc311-gen-purpose-dev` is still missing (§8). I record it at the
  first verification step instead.

## 3. Flag

**New flag `MARKETING_STICKY_ENTRY`** (`C`, `T1`), read once per page load
with `useFeatureTreatment`, like `MARKETING_PAGE`:

- `C`: today's gate (`sessionStorage`, per tab). No button.
- `T1`: entry is persisted in `localStorage` as
  `nyc311.marketing.enteredAt = <ISO timestamp>`, refreshed on each page load
  while it's valid, and removed once it's more than 7 days old. The About
  drawer shows "Back to the intro".

It's read in two places: `MarketingGate.tsx` and the About drawer's button.
Both also require `MARKETING_PAGE` = `T1`. The constants go in
`models/featureTreatment.ts`, with a mock row (`T1`) in
`test-data/featureFlags.ts`.

**Rows for the CEO to create**, before Leg 1 merges:

| Table | default_treatment | overrides / allocations |
|---|---|---|
| `FeatureFlags-Test` | `T1` | none |
| `FeatureFlags-Prod` | `C` | none |

**Why not `MARKETING_PAGE`, as the ticket proposes:** `get_flag MARKETING_PAGE`
in Prod (2026-11-14, version 6, updated 2026-11-14 00:17 UTC) returns
`default_treatment: T1`, so the marketing page is already on in Prod. The
ticket and `docs/18-marketing-page.md` both say it's off. Shipping on that flag
would put the change live in Prod at merge, with no dark period.

## 4. Legs

| Leg | Change | Packages | Depends on | Verified by | PR | State |
|---|---|---|---|---|---|---|
| 1 | `routes/marketingEntry.ts`: read, write, refresh, expire and clear the stored entry, with storage errors swallowed. `hooks/useMarketingEntry.ts` (`useSyncExternalStore`), so the gate re-renders when the button clears the entry. `MarketingGate.tsx` branches on the flag. About drawer button (`navigate("/")` after clearing). Flag constants and mock row. Unit tests for both treatments. `tests/smoke/marketingEntry.spec.ts`. `map.spec.ts` seeds both stores. `docs/18-marketing-page.md` updated | `web-app` | the §3 rows exist (the Test smoke run needs `T1`) | V1 in Test, V2 | [#229](https://github.com/seththeeke/nyc-311/pull/229) | Merged 2026-11-18 |

One leg: it's a single front-end gate, around 200 lines plus tests. The
flag's cleanup (drop `C` and the `sessionStorage` path) is its own issue, filed
after the Prod check passes.

## 5. Dial-up plan

The ticket's plan, applied to the new flag:

1. **Test `T1`** (the row from §3). Hold until V1 passes on two pipeline runs.
   Check the guardrail smoke tests too.
2. **Prod `C`**, at Leg 1's deploy. Check that `/` behaves as today and V3
   returns `C`.
3. **Prod 100% `T1`, in one step** (the CEO). Run V1 by hand right away and
   again 24 h later.

**Abort:** any of these sends `MARKETING_STICKY_ENTRY` back to `C` in Prod: a
red smoke test, any non-`/` path not reaching the shell, or a visitor who
can't reach the marketing page through the button or after 7 days.

## 6. Verification log

| Date | Step | Result | Numbers |
|---|---|---|---|
| 2026-11-15 | Flag rows | Prod created at `C` (v1, no overrides, no allocations). Test **not created**: the flag tool has no Test sign-in this run (503) | V3 now returns `C` in Prod (was 404) |
| 2026-11-15 | Leg 1 Operational Loop (`web-app/`, PR #229) | build ✅, lint ✅, test:coverage ✅ | 248 files, 1575 tests; every file ≥ 90%; `marketingEntry.ts` 95.1% stmts, 100% branches, 94.6% lines |
| 2026-11-18 | Leg 1 merged | #229 merged 17:30 UTC as `69b2374`, before the Test row existed | — |
| 2026-11-18 | Test flag row | Created `MARKETING_STICKY_ENTRY` in Test at `T1` (v1, 21:00 UTC; no overrides, no allocations). `MARKETING_PAGE` in Test is `T1` (v1) | Test was 404 before this run |
| 2026-11-18 | V1 in Test | **Not run yet.** I can't confirm `DeployTest` for `69b2374` (no AWS profile), and the `BrowserSmokeTestsTest` run for that merge ran before the Test row existed, so its sticky steps would have seen `C`. The run after the next pipeline execution counts as V1's first pass | — |

## 7. Outcome

Not yet.

## 8. Needs the CEO

- ~~Create the two `MARKETING_STICKY_ENTRY` rows~~: done. Prod `C` (2026-11-15) and Test `T1` (2026-11-18).
- #229 merged before the Test row existed. If the pipeline run for `69b2374` stopped at `BrowserSmokeTestsTest` (`marketingEntry.spec.ts` steps 3–6 would have seen `C`), release that change again in CodePipeline. The Test row is now `T1`, so the rerun should pass.
- Confirm that `MARKETING_PAGE` is meant to be `T1` in Prod. If not, set it
  back to `C`. This project works either way, but its Prod check needs
  `MARKETING_PAGE` at `T1`.
- The AWS profile `nyc311-gen-purpose-dev` still isn't configured on the Mac
  mini, so I can't read pipeline or CloudWatch state.

## Appendix: decisions

- **`localStorage`, not a cookie.** Nothing on the server reads the entry. A
  cookie would travel with every request to CloudFront and the API for no
  reason. Both survive a browser restart.
- **Sliding 7 days.** The ticket says to "refresh the cookie with a date". I
  read that as: each page load with a valid entry rewrites the timestamp, so
  the marketing page returns after more than 7 days without a visit, not 7
  days after the first entry. Expiry is strictly more than 7 × 24 h.
- **`T1` also honors the `sessionStorage` key** for the current tab. A
  visitor mid-session at the flip isn't bounced, and the existing seeding
  keeps working.
- **The button lives in the About drawer**, as the ticket suggests, rather
  than as a new sidebar control. It shows only when both flags are `T1`, so
  `C` changes nothing.
- **Leg 1 build choices (2026-11-15).** The button is its own component,
  `components/about/BackToIntroButton.tsx`. `SidebarFooter` passes it into
  `AboutOverlay` through a new optional `footer` prop, which keeps the drawer
  free of router and flag code. The gate waits for both flag reads before it
  shows the marketing page. `useMarketingEntry` re-reads the entry when the
  sticky flag resolves or the entry is cleared. The smoke spec tells the
  marketing page from the shell by Enter fleet against the sidebar's About
  button.
- **Rejected: a page-view metric.** No page-view tracking exists, and adding
  it is more than this fix needs (Celestine's comment).
