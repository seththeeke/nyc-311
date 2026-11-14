# gen-purpose-dev: #165 Make the marketing page sticky once a visitor enters the app

**Card:** #165, Assigned → **Spec Created** (2026-11-14).
**Spec:** `docs/kid-kestral/165-make-the-marketing-page-sticky-once-a-visitor-enters-the-app.md`, commit `c1dd79f`.

## What I did
- **Checked the bar.** The verification block is in Celestine's `cpo-agent:metric` comment, and both approval labels are present.
- **Read the code.** `MarketingGate.tsx` keeps the entered state in `sessionStorage`. I also read the About drawer, `useFeatureTreatment`, `map.spec.ts` (which seeds `sessionStorage`) and `docs/18-marketing-page.md`.
- **Found a discrepancy in the flag.** In Prod, `get_flag MARKETING_PAGE` returns `default_treatment: T1` (v6, updated 2026-11-14 00:17 UTC). The ticket and docs/18 both say it's off, so reusing it would ship the change live at merge. The spec uses a new flag, `MARKETING_STICKY_ENTRY`, instead:
  - `C` is today's per-tab gate.
  - `T1` stores the entry in `localStorage` with a sliding 7-day expiry, and adds a "Back to the intro" button in the About drawer.
  - Both treatments require `MARKETING_PAGE` = `T1`.

## Verification plan and "before"
- **V1 (decides the outcome):** a new smoke spec, `tests/smoke/marketingEntry.spec.ts`, running Celestine's six steps. It must pass in Test on two pipeline runs. In Prod I run it by hand right after the flip and again 24 h later.
  - Before (from the code): steps 1–2 pass. Steps 3–4 fail because `sessionStorage` is per tab. Steps 5–6 don't exist yet.
- **V2:** unit tests for `C` and `T1`.
- **V3:** `get_flag` in Prod. Before: `MARKETING_STICKY_ENTRY` returns 404.
- **Guardrails:** the smoke suite stays green, non-`/` paths pass straight through, and `C` behaves exactly as today. I couldn't take a "before" for the pipeline's smoke result because the AWS profile is missing.
- **Queries:** no warehouse queries, because no page-view data exists. I made two `get_flag` reads.

## Legs
1. `web-app` only: the entry module and hook, the gate, the About button, unit tests, the smoke spec, `map.spec.ts` seeding both stores, and the docs/18 update. It depends on the flag rows existing.

## Next (CEO)
- Create the rows: `FeatureFlags-Test` `T1`, `FeatureFlags-Prod` `C`.
- Confirm `MARKETING_PAGE` is meant to be `T1` in Prod.
- Configure the `nyc311-gen-purpose-dev` AWS profile.
- The card is held in Spec Created for 12 h.

Ticket comment: issuecomment-6884151950. Chat post: 01M7DXWSHBG42FKZFH1W7WFP81.
