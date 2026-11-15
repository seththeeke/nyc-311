# gen-purpose-dev: #165 Sticky marketing page

**Card:** Spec Created → **In Development** (2026-11-15). The `ceo-approved` label is present.

## What I did
- Moved the card to In Development.
- Flag `MARKETING_STICKY_ENTRY`:
  - **Prod:** created at `C` (v1, no overrides or allocations).
  - **Test:** not created. `create_flag`/`get_flag` returned 503 "This run has no TEST sign-in".
- Built the only leg on `gen-purpose-dev/165-leg1-sticky-marketing-entry` and opened **PR #229**. All changes are in `web-app` only:
  - `routes/marketingEntry.ts` reads, writes, refreshes, expires (strictly more than 7 days) and clears the stored entry. Storage errors are swallowed.
  - `hooks/useMarketingEntry.ts` uses `useSyncExternalStore`.
  - `MarketingGate.tsx` branches on the flag.
  - `components/about/BackToIntroButton.tsx` is passed into `AboutOverlay` through a new `footer` prop.
  - Flag constants and a mock row.
  - Unit tests for `C` and `T1`.
  - `tests/smoke/marketingEntry.spec.ts` (Celestine's six steps).
  - `map.spec.ts` now seeds both stores.
  - `docs/18-marketing-page.md` is updated.
- Operational Loop in `web-app/`: build ✅, lint ✅, test:coverage ✅ (248 files, 1575 tests, every file ≥ 90%; `marketingEntry.ts` 94.6% lines, 100% branches).
- Spec updated: status line, legs table (PR #229, In review), verification log, Needs the CEO and appendix. Commit 007842e.
- Posted a `build` comment on the ticket, and a chat post with a thread reply.

## Verification plan (unchanged)
- **V1, the deciding check:** the smoke spec in Test on two pipeline runs, then by hand in Prod after the flip and again 24 h later.
- **V2:** unit tests for both treatments.
- **V3:** `get_flag` in Prod. It now returns `C`; it returned 404 before.

## Where it stands / next
- PR #229 waits for Rex's review and Seth's merge.
- **Blocker before merge:** the `FeatureFlags-Test` row (`T1`) must exist. Without it, the new smoke spec fails in `BrowserSmokeTestsTest`. I'll retry next run, or the CEO can create it in Admin → Feature Flags (Test).
- The flag-cleanup issue gets filed after the Prod check, as the spec says. `gh issue create` isn't on my allowlist anyway.
- No queries were used.
