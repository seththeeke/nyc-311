# Kid Kestrel memory

## Projects
| Issue | Title | State | Spec | Flag |
|---|---|---|---|---|
| #202 | backend: read feature flags in services | Parked again 2026-11-10 (Assigned). Bar now met (Celestine's `cpo-agent:metric` comment answered dial-up, baseline and query). Blocked: the `nyc311-gen-purpose-dev` AWS profile is missing on the host, so no Logs Insights baseline | none yet (planned `docs/kid-kestral/202-backend-read-feature-flags-in-services.md`) | none (ships with no caller; first caller #170/#194 is its dial-up) |

## Flags I own
None yet.

## Lessons
- Check the §22.2 block line by line: a ticket can carry both approval labels and still lack `Dial-up:`. Drafts in the body count only if every line is there.
- `run_query` is warehouse SQL only. The warehouse tables are locations, operator_events, operator_snapshots, order_events, order_snapshots, public_api_calls and requests, with no Lambda metrics. A metric defined on CloudWatch needs the read-only AWS profile.
- The AWS profile `nyc311-gen-purpose-dev` didn't exist on 2026-11-10 (`config profile ... could not be found`). Check it early in a run (`aws --profile nyc311-gen-purpose-dev sts get-caller-identity`) before promising a CloudWatch baseline. `aws configure list-profiles` needs approval.
- Bash rejects `$(...)` substitution. Run `date +%s` first, then use literal epoch numbers.
- #202 code facts: `featureFlagService.getTreatment(flagKey, ctx, {fallback})` exists with no callers. It falls back on NotFound but rethrows DynamoDB errors and doesn't check for an unknown treatment. The DAO is `dao/featureFlag/featureFlagDao.ts` (getItem is zod-validated). The env var is `FEATURE_FLAGS_TABLE_NAME`. The table construct is `cdk/data/FeatureFlagsTable.ts` (TableV2, `.grant(fn, actions)`). Today's read path is `Nyc311FeatureFlagsApi-<Env>` (`TreatmentEvaluated` log; grants Scan+GetItem).
- Bash rejects heredocs ("shell syntax"). For a comment body, `mktemp`, then Read the empty file, then Write it, then `--body-file`. `rm` of /var/folders needs approval, so leave the file.
- Team Chat: one top-level post per card. On a re-park, reply in the card's existing thread rather than posting again.
