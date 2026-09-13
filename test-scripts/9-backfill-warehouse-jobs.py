#!/usr/bin/env python3
"""
One-time backfill (7-data-warehousing.md §8, Leg 8): creates the four
warehouse jobs that shipped as checked-in `.sql` files through Legs 3.5/6
as self-service job definitions instead, via the real, admin-authorized
POST /admin/warehouse/jobs endpoint — not a direct DynamoDB/S3 write. The
SQL text below is embedded verbatim (copied from cdk/warehouse/sql/*.sql
before those files were deleted in the same change that added this
script) — same SQL, same job names, same cadence, mechanism change only.

Idempotent in the sense that mirrors 7-seed-capacity.py: a name collision
(409, the job already exists) is reported and skipped rather than treated
as a fatal error, so re-running this after a partial run is safe.

Signs in as the dedicated test-admin Cognito user
(test-scripts/6-setup-test-admin.py provisions it) via Cognito's
InitiateAuth, the same USER_PASSWORD_AUTH flow the pipeline's integration
suite uses.

NOT read-only: creates real WarehouseJobRuns definition rows, S3 SQL
objects, and EventBridge Scheduler schedules in the target environment.

Requires: AWS CLI v2 + a "nyc311" profile with cloudformation:DescribeStacks,
secretsmanager:GetSecretValue, and cognito-idp:InitiateAuth against the
target environment's resources.

Usage:
    python3 test-scripts/9-backfill-warehouse-jobs.py            # Nyc311-Test
    python3 test-scripts/9-backfill-warehouse-jobs.py --prod     # Nyc311-Prod
"""

import argparse
import json
import subprocess
import sys
import urllib.error
import urllib.request

AWS_PROFILE = "nyc311"

# Daily at 09:00 UTC — matches the old rate(1 day) schedule's approximate fire time.
DAILY_09_UTC_CRON = "cron(0 9 * * ? *)"

JOBS = [
    {
        "name": "order_volume_by_stage_7d",
        "cadence_cron": DAILY_09_UTC_CRON,
        "sql": """-- 7-data-warehousing.md §8 — order volume by (created-date, current stage)
-- over the trailing 7 created-date buckets. From the latest order_snapshots
-- row per order_id (dedup by warehouse_ingested_at). Emits one row per
-- (created_date, stage); the runner stores the resultset verbatim as
-- job-results/job_name=order_volume_by_stage_7d/run_date=<date>/result.json
-- and it becomes one row of the job_results Glue table (§11).
WITH latest AS (
  SELECT
    order_id,
    current_stage,
    substr(created_at, 1, 10) AS created_date,
    ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY warehouse_ingested_at DESC) AS rn
  FROM order_snapshots
)
SELECT
  created_date,
  current_stage AS stage,
  CAST(COUNT(*) AS varchar) AS order_count
FROM latest
WHERE rn = 1
  AND created_date >= date_format(date_add('day', -6, current_date), '%Y-%m-%d')
GROUP BY created_date, current_stage
ORDER BY created_date, current_stage
""",
    },
    {
        "name": "order_volume_by_stage_8w",
        "cadence_cron": DAILY_09_UTC_CRON,
        "sql": """-- 7-data-warehousing.md §8/§12 — order volume by (creation-week, current
-- stage) over the trailing ~8 ISO weeks. The week bucketing is done here in
-- SQL, so every daily run recomputes all 8 weeks with *current* stages and
-- the latest result.json is a complete week-over-week trend. This is what
-- GET /reports reads (materialized, no Athena on the read path). From the
-- latest order_snapshots row per order_id; a row whose created_at doesn't
-- parse to a date is dropped rather than failing the query.
WITH latest AS (
  SELECT
    order_id,
    current_stage,
    try(date_trunc('week', date(substr(created_at, 1, 10)))) AS created_week,
    ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY warehouse_ingested_at DESC) AS rn
  FROM order_snapshots
)
SELECT
  date_format(created_week, '%Y-%m-%d') AS week_start,
  current_stage AS stage,
  CAST(COUNT(*) AS varchar) AS order_count
FROM latest
WHERE rn = 1
  AND created_week IS NOT NULL
  AND created_week >= date_trunc('week', current_date - interval '55' day)
GROUP BY date_format(created_week, '%Y-%m-%d'), current_stage
ORDER BY week_start, stage
""",
    },
    {
        "name": "order_volume_by_borough",
        "cadence_cron": DAILY_09_UTC_CRON,
        "sql": """-- 7-data-warehousing.md §8 — count of Orders per borough, the payoff of
-- warehousing Locations. Latest order_snapshots row per order_id, joined
-- to the latest locations row per location_id (= bbl). Orders whose
-- Request never resolved a bbl, or whose Location has no borough, land in
-- 'UNKNOWN' rather than being dropped. Emits (borough, order_count).
WITH latest_order AS (
  SELECT
    order_id,
    location_id,
    ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY warehouse_ingested_at DESC) AS rn
  FROM order_snapshots
),
latest_location AS (
  SELECT
    location_id,
    borough,
    ROW_NUMBER() OVER (PARTITION BY location_id ORDER BY warehouse_ingested_at DESC) AS rn
  FROM locations
)
SELECT
  COALESCE(l.borough, 'UNKNOWN') AS borough,
  CAST(COUNT(*) AS varchar) AS order_count
FROM latest_order o
LEFT JOIN latest_location l
  ON o.location_id = l.location_id AND l.rn = 1
WHERE o.rn = 1
GROUP BY COALESCE(l.borough, 'UNKNOWN')
ORDER BY borough
""",
    },
    {
        "name": "operator_fleet_cost_to_date",
        "cadence_cron": DAILY_09_UTC_CRON,
        "sql": """-- 7-data-warehousing.md §8 (Leg 6) — 10-capacity-modeling-and-integration.md
-- §2.3's "all-time accumulated cost": rate_per_hour x hours elapsed from
-- start_datetime to end_datetime (or now, for a still-active Operator).
-- One row per Operator ever added, from the latest operator_snapshots row
-- per operator_id (dedup by warehouse_ingested_at), ordered by cost
-- descending. Emits (operator_id, name, rate_per_hour, accumulated_cost).
WITH latest_operator AS (
  SELECT
    operator_id,
    name,
    rate_per_hour,
    start_datetime,
    end_datetime,
    ROW_NUMBER() OVER (PARTITION BY operator_id ORDER BY warehouse_ingested_at DESC) AS rn
  FROM operator_snapshots
),
cost AS (
  SELECT
    operator_id,
    name,
    rate_per_hour,
    ROUND(
      date_diff(
        'second',
        from_iso8601_timestamp(start_datetime),
        COALESCE(from_iso8601_timestamp(end_datetime), current_timestamp)
      ) / 3600.0 * rate_per_hour,
      2
    ) AS accumulated_cost
  FROM latest_operator
  WHERE rn = 1
)
SELECT
  operator_id,
  name,
  CAST(rate_per_hour AS varchar) AS rate_per_hour,
  CAST(accumulated_cost AS varchar) AS accumulated_cost
FROM cost
ORDER BY accumulated_cost DESC
""",
    },
]


def aws(*args):
    result = subprocess.run(
        ["aws", "--profile", AWS_PROFILE, *args], capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"  ! aws {' '.join(args[:2])} failed: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(1)
    return result.stdout


def stack_output(stack_name, output_key):
    stacks = json.loads(aws("cloudformation", "describe-stacks", "--stack-name", stack_name, "--output", "json"))
    outputs = {o["OutputKey"]: o["OutputValue"] for o in stacks["Stacks"][0]["Outputs"]}
    value = outputs.get(output_key)
    if not value:
        print(f"FAIL: {stack_name} has no {output_key} output — has this leg been deployed?")
        sys.exit(1)
    return value


def get_id_token(client_id, secret_name):
    secret = json.loads(aws("secretsmanager", "get-secret-value", "--secret-id", secret_name, "--output", "json"))
    cred = json.loads(secret["SecretString"])
    auth = json.loads(
        aws(
            "cognito-idp", "initiate-auth",
            "--client-id", client_id,
            "--auth-flow", "USER_PASSWORD_AUTH",
            "--auth-parameters", f"USERNAME={cred['email']},PASSWORD={cred['password']}",
            "--output", "json",
        )
    )
    return auth["AuthenticationResult"]["IdToken"]


def call_api(method, url, id_token, body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"Authorization": f"Bearer {id_token}"})
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--prod", action="store_true", help="target Nyc311-Prod instead of Nyc311-Test")
    args = parser.parse_args()
    stack = "Nyc311-Prod" if args.prod else "Nyc311-Test"
    suffix = "Prod" if args.prod else "Test"

    print(f"Looking up API URL and User Pool client on {stack}...")
    api_url = stack_output(stack, "Nyc311ApiUrl").rstrip("/")
    client_id = stack_output(stack, "Nyc311AdminUserPoolClientId")

    print("Signing in as the test-admin...")
    id_token = get_id_token(client_id, f"Nyc311AdminTestCredential-{suffix}")

    created, skipped, failed = [], [], []
    for job in JOBS:
        status, body = call_api("POST", f"{api_url}/admin/warehouse/jobs", id_token, job)
        if status == 201:
            print(f"  ...created {job['name']} (schedule {body['schedule_name']})")
            created.append(job["name"])
        elif status == 409:
            print(f"  ...skipped {job['name']} (already exists)")
            skipped.append(job["name"])
        else:
            print(f"  ! FAIL: POST /admin/warehouse/jobs for {job['name']} returned {status}: {body}")
            failed.append(job["name"])

    print(f"\ncreated={created} skipped={skipped} failed={failed}")
    if failed:
        sys.exit(1)
    print("PASS")


if __name__ == "__main__":
    main()
