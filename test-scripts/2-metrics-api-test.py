#!/usr/bin/env python3
"""
Manual smoke test for the public NYC 311 ingestion-metrics API, against the
live Nyc311-Test environment.

Looks up the deployed API's base URL from Nyc311-Test's CloudFormation
outputs (Nyc311Stack's Nyc311ApiUrl output), calls GET /ingestion/metrics,
and confirms the response is a well-formed JSON array of poller-run metric
records matching backend/models/pollerMetrics.ts's shape.

Read-only against AWS (a single cloudformation:DescribeStacks call) plus one
plain HTTP GET against the public API — does not require any DynamoDB or
Lambda permissions, only describe-stacks.

Requires: AWS CLI v2, configured with a "nyc311" profile that can
cloudformation:DescribeStacks against Nyc311-Test.

Usage:
    python3 test-scripts/2-metrics-api-test.py
"""

import json
import subprocess
import sys
import urllib.error
import urllib.request

AWS_PROFILE = "nyc311"
STACK_NAME = "Nyc311-Test"
OUTPUT_KEY = "Nyc311ApiUrl"
ROUTE = "/ingestion/metrics"
REQUEST_TIMEOUT_SECONDS = 15

REQUIRED_FIELDS = {
    "ran_at",
    "success",
    "records_ingested",
    "duplicates_skipped",
    "records_rejected",
    "error_message",
}


def get_api_base_url() -> str:
    """Reads the Nyc311ApiUrl CfnOutput off the live Nyc311-Test stack."""
    result = subprocess.run(
        [
            "aws", "cloudformation", "describe-stacks",
            "--stack-name", STACK_NAME,
            "--profile", AWS_PROFILE,
            "--output", "json",
        ],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"Failed to describe {STACK_NAME}:\n{result.stderr}", file=sys.stderr)
        sys.exit(1)

    stacks = json.loads(result.stdout)["Stacks"]
    outputs = {o["OutputKey"]: o["OutputValue"] for o in stacks[0].get("Outputs", [])}
    url = outputs.get(OUTPUT_KEY)
    if not url:
        print(
            f"No '{OUTPUT_KEY}' output on {STACK_NAME} — has Nyc311Api been deployed yet?",
            file=sys.stderr,
        )
        sys.exit(1)
    return url.rstrip("/")


def main() -> None:
    base_url = get_api_base_url()
    url = f"{base_url}{ROUTE}"
    print(f"GET {url}")

    try:
        with urllib.request.urlopen(url, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            status = response.status
            body = json.loads(response.read())
    except urllib.error.HTTPError as exc:
        print(f"Request failed with HTTP {exc.code}:\n{exc.read().decode(errors='replace')}", file=sys.stderr)
        sys.exit(1)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        print(f"Request failed: {exc}", file=sys.stderr)
        sys.exit(1)

    if status != 200:
        print(f"Expected 200, got {status}:\n{body}", file=sys.stderr)
        sys.exit(1)

    metrics = body.get("metrics")
    if not isinstance(metrics, list):
        print(
            f"Expected a 'metrics' array in the response body, got:\n{json.dumps(body, indent=2)}",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"\n{len(metrics)} poller metric record(s) returned.")
    for i, item in enumerate(metrics[:3]):
        missing = REQUIRED_FIELDS - set(item.keys())
        if missing:
            print(f"Record {i} is missing expected field(s): {missing}", file=sys.stderr)
            sys.exit(1)
        print(f"  [{i}] ran_at={item['ran_at']} success={item['success']} ingested={item['records_ingested']}")

    print("\nMetrics API smoke test PASSED.")


if __name__ == "__main__":
    main()
