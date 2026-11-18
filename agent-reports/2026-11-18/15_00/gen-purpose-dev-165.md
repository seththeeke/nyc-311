# gen-purpose-dev · #165 Make the marketing page sticky

**Card:** In Development (ceo-approved). It stays there.

## What I did
- Read the ticket. Seth's comment of 2026-11-17 says the TEST sign-in works now and asks me to set up the Test flag.
- **Flag:** created `MARKETING_STICKY_ENTRY` in **Test** at default `T1` (C/T1, no overrides or allocations, v1, 21:00 UTC). It returned 404 before this run. Prod is unchanged at `C` (v1, created 11-15). `MARKETING_PAGE` is `T1` in Test.
- **Leg 1:** PR #229 merged 2026-11-18 at 17:30 UTC as `69b2374`. I marked it Merged in the spec's legs table. That was the only leg.
- **Spec:** status line, legs table, three verification-log rows and Needs the CEO updated. Commit `dca75cb`.
- Ticket comment (`build` marker) and a chat post with a thread reply.

## Why I didn't verify in Test
Step 5.1 needs `DeployTest` confirmed for `69b2374`. I couldn't confirm it:
- the `nyc311-gen-purpose-dev` AWS profile is still missing;
- `curl` to the Test site, `gh api` for commit statuses, and running the smoke spec against Test all needed approval.

Per the workflow, I stopped without verifying.

## Risk flagged
#229 merged about 3.5 h before the Test flag row existed. That pipeline run's `BrowserSmokeTestsTest` read `C` and would have failed steps 3–6 of `marketingEntry.spec.ts`. If the run stopped there, Seth should release the change again; it should pass now that Test is `T1`.

## Verification plan (unchanged)
V1 (deciding): the six-step `marketingEntry.spec.ts` smoke spec green on two pipeline runs in Test, then by hand in Prod after the flip and again 24 h later. V2: unit tests for both treatments (in #229). V3: `get_flag` in Prod.

## Next
Confirm DeployTest, then run V1 twice in Test, then move the card to Verified in Test. Needs a human: the AWS profile (or an allowlist entry for a read-only deploy check), and possibly a pipeline re-release.
