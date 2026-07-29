# 311 Test Data

Sample pulls of real NYC 311 data (Socrata `erm2-nwe9` dataset), used to inform
the DynamoDB data model design (`docs/data-model.md`).

## Pulling data

```
node 311-test-data/pull-nyc-311-data.js --hours 6
```

- `--hours N` — how many hours back to pull (default `6`).
- `--out <path>` — override the output file path (default:
  `nyc-311-<hours>h-<timestamp>.json` in this directory).
- Set `SOCRATA_APP_TOKEN` in the environment to raise the API's unauthenticated
  rate limit (not required at this volume).

Output is a single JSON file: `{ pulled_at, hours_requested, since, record_count,
source, records[] }`. Pulled data files are gitignored — re-run the script to
regenerate rather than committing snapshots.

Note: citywide volume runs ~9,000+ records/day, so keep `--hours` small (single
digits) for a file that's actually practical to browse.
