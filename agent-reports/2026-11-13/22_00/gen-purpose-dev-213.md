# gen-purpose-dev: #213, WBR fleet cost

**Card:** #213, "WBR: count paid fleet hours, idle time and fleet cost". It was in Assigned and is now **in Intake (pushed back)**.

## What I did
- Checked the bar. The verification block and both approvals (`cpo-approved`, `cto-approved`) were present. The block's Flag line reads "none needed".
- Read `docs/v1-wbr.sql`, F8/#44 in `v1-prod-deployment.md`, `get_wbr` in the product client, the web-app warehouse-jobs panel and §22.2–22.5.
- Found that the change is a warehouse job definition applied by hand through the admin UI. No code path reads a flag: the web-app has no WBR view, and `get_wbr` is backend, which can't read flags until #202.
- Took the "before" with one warehouse query.
- Posted a pushback comment (https://github.com/seththeeke/nyc-311/issues/213#issuecomment-6871432415) and moved the card to Intake, which cleared both approvals. Posted to #tech-team with a thread reply.

## Why it's back in Intake
1. It can't ship behind a flag as written. My rules don't let me spec around that.
2. Only a human can apply the job SQL, and the Dial-up line doesn't name who.
3. Smaller conflicts: Rex's scope comment uses operator event names that don't exist (`IdleStarted`, `CheckedOut`, ...). It also mentions changing `total_cost`, which contradicts the byte-identical guardrail. `accepted_cohort_cost` is still open.

## Proposals
- **A (my pick):** Seth records a §22.4 exemption for additive warehouse-job SQL. The dial-up becomes: PR to `docs/v1-wbr.sql` → the CEO applies it to Test → I check it → the CEO applies it to Prod → I check again.
- **B:** a separate `wbr_fleet` job, which ships dark, plus a flagged consumer: `get_wbr` after #202, or an admin web-app panel.

## Verification plan and before (2026-11-13)
Fleet time budget: deduped `operator_events`, `LEAD` intervals, split at Monday week boundaries, × latest `rate_per_hour`.

| Week | Paid h | Working | Transit | Idle | Fleet cost | Idle cost |
|---|---|---|---|---|---|---|
| Oct 26 | 849.3 | 532.2 | 162.7 | 154.4 | $38,217 | $6,946 |
| Nov 2 | 2,319.4 | 1,391.4 | 484.8 | 443.3 | $104,373 | $19,946 |

For the week of Nov 2, fleet − idle ($84.4k) is within 0.4% of the WBR's labor ($84.1k). The ticket's 2% reconciliation target is already met on past data, so the SQL design is sound. The query scanned 3.1 MB in 2.2 s, well under the guardrail of 20 s and 1 GB.

## Next
@Rex and @Celestine refine the ticket, and Seth decides on option A or B. After that the ticket is re-approved and reassigned. The AWS profile `nyc311-gen-purpose-dev` is still missing on the host.
