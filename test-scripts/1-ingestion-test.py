#!/usr/bin/env python3
"""
Manual ingestion smoke test against the Test environment.

Invokes the NYC 311 poller Lambda the same way EventBridge Scheduler
does (asynchronously), polls CloudWatch Logs for its PollCompleted (or
PollerControllerFailed) structured log line, then confirms DRAFT Request
records actually exist in DynamoDB.

NOT read-only: this triggers a real poll against the live NYC 311 SODA
API and writes real Request items into Requests-Test. Re-running it
immediately is safe but likely uninteresting — ingestion dedupes by
external_unique_key, so a window that already drained will just report
0 records_ingested (a legitimate outcome, not a failure).

Requires: AWS CLI v2, configured with a "nyc311" profile that can
lambda:InvokeFunction, logs:FilterLogEvents, and dynamodb:Query against
the Test environment's resources.

Usage:
    python3 test-scripts/1-ingestion-test.py
"""

import json
import os
import subprocess
import sys
import tempfile
import time

AWS_PROFILE = "nyc311"
FUNCTION_NAME = "Nyc311Poller-Test"
LOG_GROUP_NAME = "/aws/lambda/Nyc311Poller-Test"
TABLE_NAME = "Requests-Test"
STATUS_INDEX = "gsi2-status"
DLQ_NAME = "Nyc311PollerDlq-Test"

POLL_INTERVAL_SECONDS = 5
# The Lambda itself times out at 5 minutes (cdk/lambda/Nyc311PollerLambda.ts)
# plus room for CloudWatch Logs ingestion lag.
MAX_WAIT_SECONDS = 360

# Matches on either the successful or failed terminal log line emitted by
# backend/controller/ingestion/nyc311PollerController.ts, so a genuine
# failure ends the wait immediately rather than running out the clock.
COMPLETION_FILTER_PATTERN = (
    '{ ($.message = "PollCompleted") || ($.message = "Nyc311PollerControllerFailed") }'
)


def run_aws_cli(args: list[str]) -> dict:
    """Runs `aws <args> --profile nyc311 --output json` and returns the parsed response (or {} for empty output)."""
    command = ["aws", *args, "--profile", AWS_PROFILE, "--output", "json"]
    try:
        result = subprocess.run(command, capture_output=True, text=True)
    except FileNotFoundError:
        print("The `aws` CLI isn't on PATH — install/configure AWS CLI v2 first.", file=sys.stderr)
        sys.exit(1)

    if result.returncode != 0:
        print(f"AWS CLI command failed: {' '.join(command)}", file=sys.stderr)
        print(result.stderr, file=sys.stderr)
        sys.exit(1)

    stdout = result.stdout.strip()
    return json.loads(stdout) if stdout else {}


def count_draft_requests() -> int:
    """Queries gsi2-status for status = DRAFT and returns the item count."""
    response = run_aws_cli(
        [
            "dynamodb",
            "query",
            "--table-name", TABLE_NAME,
            "--index-name", STATUS_INDEX,
            "--key-condition-expression", "gsi2pk = :status",
            "--expression-attribute-values", json.dumps({":status": {"S": "DRAFT"}}),
            "--select", "COUNT",
        ]
    )
    return response.get("Count", 0)


def trigger_poll() -> int:
    """Asynchronously invokes the poller Lambda and returns the invocation's start time (epoch ms)."""
    start_time_ms = int(time.time() * 1000)
    print(f"Invoking {FUNCTION_NAME} (async — matching its real EventBridge Scheduler trigger)...")

    fd, output_path = tempfile.mkstemp(prefix="nyc311-ingestion-test-")
    os.close(fd)
    try:
        response = run_aws_cli(
            [
                "lambda", "invoke",
                "--function-name", FUNCTION_NAME,
                "--invocation-type", "Event",
                "--payload", "{}",
                "--cli-binary-format", "raw-in-base64-out",
                output_path,
            ]
        )
    finally:
        os.remove(output_path)

    status_code = response.get("StatusCode")
    if status_code != 202:
        print(f"Expected StatusCode 202 (accepted) for an async invoke, got {status_code}.", file=sys.stderr)
        sys.exit(1)

    return start_time_ms


def parse_structured_log_line(message: str) -> dict:
    """
    Strips the Lambda Node.js runtime's default "Text" logging prefix
    (`<ISO-timestamp>\\t<request-id>\\t<LEVEL>\\t`) that CloudWatch Logs
    prepends ahead of the JSON line logger.ts actually wrote, then parses
    the remainder.
    """
    return json.loads(message[message.index("{"):])


def wait_for_completion(start_time_ms: int) -> dict:
    """Polls CloudWatch Logs until the PollCompleted/PollerControllerFailed line for this invocation shows up."""
    deadline = time.monotonic() + MAX_WAIT_SECONDS
    print(f"Waiting up to {MAX_WAIT_SECONDS}s for the poll to finish (log group {LOG_GROUP_NAME})...")

    while time.monotonic() < deadline:
        response = run_aws_cli(
            [
                "logs", "filter-log-events",
                "--log-group-name", LOG_GROUP_NAME,
                "--start-time", str(start_time_ms),
                "--filter-pattern", COMPLETION_FILTER_PATTERN,
            ]
        )
        events = response.get("events", [])
        if events:
            return parse_structured_log_line(events[0]["message"])
        time.sleep(POLL_INTERVAL_SECONDS)

    print(
        f"Timed out after {MAX_WAIT_SECONDS}s waiting for completion. "
        f"Check {LOG_GROUP_NAME} and the {DLQ_NAME} queue directly.",
        file=sys.stderr,
    )
    sys.exit(1)


def main() -> None:
    draft_count_before = count_draft_requests()

    start_time_ms = trigger_poll()
    result = wait_for_completion(start_time_ms)

    if result.get("message") != "PollCompleted":
        print(f"Poll did not complete successfully:\n{json.dumps(result, indent=2)}", file=sys.stderr)
        sys.exit(1)

    records_ingested = result.get("records_ingested", 0)
    print("\nPoll completed:")
    print(f"  records_ingested:   {records_ingested}")
    print(f"  duplicates_skipped: {result.get('duplicates_skipped')}")
    print(f"  records_rejected:   {result.get('records_rejected')}")

    draft_count_after = count_draft_requests()
    print(f"\n{TABLE_NAME} DRAFT count: {draft_count_before} -> {draft_count_after}")

    if draft_count_after == 0:
        print("\nNo DRAFT records exist in Requests-Test at all — ingestion test FAILED.", file=sys.stderr)
        sys.exit(1)

    # 0 newly-ingested records is a legitimate outcome (the window already
    # drained on a prior run — dedup makes re-processing it a no-op), but if
    # the Lambda itself reported ingesting records, the table should show it.
    if records_ingested > 0 and draft_count_after <= draft_count_before:
        print(
            f"\nLambda reported {records_ingested} newly-ingested records, but the DRAFT "
            "count in DynamoDB didn't increase — ingestion test FAILED.",
            file=sys.stderr,
        )
        sys.exit(1)

    print("\nIngestion test PASSED.")


if __name__ == "__main__":
    main()
