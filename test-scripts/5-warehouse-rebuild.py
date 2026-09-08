#!/usr/bin/env python3
"""
Manual on-demand warehouse rebuild (7-data-warehousing.md §10, Leg 4).

Starts the Nyc311WarehouseRebuild-<env> Step Functions state machine and
polls describe-execution to completion. The machine — in parallel, per
source (orders / requests / locations) — takes a DynamoDB PITR export
pinned to the execution start time, waits for it to COMPLETE, then invokes
the rebuild worker Lambda: wipe data/<table>/ and replay every row through
the live Firehose (stamped ingestion_source=REBUILD,
warehouse_ingested_at=<ExportTime>). Live capture is never paused. When
every source finishes, the job runner re-runs so fresh resultsets land.

NOT read-only: wipes and repopulates the warehouse's data/ prefix for all
three sources, writes REBUILD_<SOURCE> WarehouseJobRuns rows, and triggers
a job-runner pass (a few Athena queries). Cost is a handful of cents; the
operational tables are untouched.

Requires: AWS CLI v2 + a "nyc311" profile with
cloudformation:DescribeStacks and states:StartExecution/DescribeExecution.

Usage:
    python3 test-scripts/5-warehouse-rebuild.py            # Nyc311-Test
    python3 test-scripts/5-warehouse-rebuild.py --prod     # Nyc311-Prod
"""

import argparse
import json
import subprocess
import sys
import time

AWS_PROFILE = "nyc311"
OUTPUT_KEY = "Nyc311WarehouseRebuildStateMachineArn"
POLL_INTERVAL_SECONDS = 15
MAX_WAIT_SECONDS = 60 * 60


def aws(*args):
    result = subprocess.run(
        ["aws", "--profile", AWS_PROFILE, *args], capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"  ! aws {' '.join(args[:2])} failed: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(1)
    return result.stdout


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--prod", action="store_true", help="target Nyc311-Prod instead of Nyc311-Test")
    args = parser.parse_args()
    stack = "Nyc311-Prod" if args.prod else "Nyc311-Test"

    print(f"Looking up {OUTPUT_KEY} on {stack}...")
    stacks = json.loads(aws("cloudformation", "describe-stacks", "--stack-name", stack))
    outputs = {o["OutputKey"]: o["OutputValue"] for o in stacks["Stacks"][0].get("Outputs", [])}
    state_machine_arn = outputs.get(OUTPUT_KEY)
    if not state_machine_arn:
        print(f"FAIL: {stack} has no {OUTPUT_KEY} output — has Leg 4 been deployed?")
        sys.exit(1)

    print(f"Starting execution of {state_machine_arn}")
    started = json.loads(aws("stepfunctions", "start-execution", "--state-machine-arn", state_machine_arn, "--input", "{}"))
    execution_arn = started["executionArn"]

    waited = 0
    status = "RUNNING"
    while waited < MAX_WAIT_SECONDS:
        described = json.loads(aws("stepfunctions", "describe-execution", "--execution-arn", execution_arn))
        status = described["status"]
        if status != "RUNNING":
            break
        print(f"  ...{status} ({waited}s)")
        time.sleep(POLL_INTERVAL_SECONDS)
        waited += POLL_INTERVAL_SECONDS

    if status != "SUCCEEDED":
        print(f"FAIL: execution {status}")
        print(json.dumps(described, indent=2, default=str))
        sys.exit(1)

    output = json.loads(described.get("output", "[]"))
    print("PASS: rebuild SUCCEEDED")
    print(json.dumps(output, indent=2, default=str))


if __name__ == "__main__":
    main()
