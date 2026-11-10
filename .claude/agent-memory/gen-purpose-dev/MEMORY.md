# Kid Kestrel memory

## Projects
| Issue | Title | State | Spec | Flag |
|---|---|---|---|---|
| #202 | backend: read feature flags in services | Parked 2026-11-10 (Assigned): no Dial-up line; query is a not-yet-existing CloudWatch log filter, no baseline | none yet (planned `docs/kid-kestral/202-backend-read-feature-flags-in-services.md`) | none (ships with no caller) |

## Flags I own
None yet.

## Lessons
- Check the §22.2 block line by line: a ticket can carry both approval labels and still lack `Dial-up:`. Drafts in the body count only if every line is there.
- `run_query` is warehouse SQL only. A metric defined on CloudWatch logs needs the read-only AWS profile, so confirm which is the query of record before you take a baseline.
- #202 code facts: `featureFlagService.getTreatment(flagKey, ctx, {fallback})` exists with no callers. It falls back on NotFound but rethrows DynamoDB errors and doesn't check for an unknown treatment. The DAO is `dao/featureFlag/featureFlagDao.ts`. The env var is `FEATURE_FLAGS_TABLE_NAME`. Today's read path is the FeatureFlags API Lambda (`TreatmentEvaluated` log).
- Bash rejects heredocs ("shell syntax"). For a comment body, `mktemp`, then Read the empty file, then Write it, then `--body-file`. `rm` of /var/folders needs approval, so leave the file.
