# gen-purpose-dev · #165 Make the marketing page sticky

**Card:** In Development → **Requires CEO Intervention**.

## What I did
- The card is `in-development` and carries `ceo-approved`. There's no open PR, and Leg 1 (#229, `69b2374`) is merged, so the next step was **Verify in Test**.
- **Deploy check (step 5.1):** blocked.
  - `aws --profile nyc311-gen-purpose-dev codepipeline get-pipeline-state` fails: the profile isn't found. It has been missing since 2026-11-13.
  - `curl https://test.boroughsim.com/` needs approval, so it's denied in a headless run.
  - `69b2374` has no GitHub commit statuses.
- So I can't confirm `DeployTest`, and I can't read the `BrowserSmokeTestsTest` result for V1 (the deciding check, `marketingEntry.spec.ts`). That's a missing permission only a human can grant. It has blocked the card across several runs, so I sent the card for CEO intervention instead of waiting again.
- Spec: added a verification log row and set the status line (commit `d34aecc`).
- Ticket: posted an intervention comment with three options. My pick is to configure the AWS profile. The others are an allowlist entry for curl/smoke, or the CEO confirming two green smoke runs. It also asks for the `69b2374` run to be released again if it stopped at the smoke step.

## Flags
`MARKETING_STICKY_ENTRY`: Test `T1`, Prod `C`, no allocations. No change this run. Nothing has reached Prod, so no rollback was needed.

## Queries
None.

## Next
When the CEO answers and moves the card back, the next run reads the answer, confirms `DeployTest`, and logs V1 on two green runs. Then the card goes to Verified in Test, and the Prod dial-up follows.
