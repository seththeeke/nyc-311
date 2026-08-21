#!/usr/bin/env python3
"""
Manual smoke test for the public Orders list API, against the live
Nyc311-Test environment.

Looks up the deployed API's base URL from Nyc311-Test's CloudFormation
outputs (Nyc311Stack's Nyc311ApiUrl output), calls GET /orders with a small
limit, confirms the response is a well-formed paginated envelope matching
backend/models/orderListQuery.ts's OrderListResult shape, then — if a
nextCursor came back — follows it one page further and confirms the stage
filter (GET /orders?stage=INGEST) only ever returns INGEST orders.

Read-only against AWS (a single cloudformation:DescribeStacks call) plus
plain HTTP GETs against the public API — does not require any DynamoDB or
Lambda permissions, only describe-stacks.

Requires: AWS CLI v2, configured with a "nyc311" profile that can
cloudformation:DescribeStacks against Nyc311-Test.

Usage:
    python3 test-scripts/3-orders-api-test.py
"""

import json
import subprocess
import sys
import urllib.error
import urllib.request

AWS_PROFILE = "nyc311"
STACK_NAME = "Nyc311-Test"
OUTPUT_KEY = "Nyc311ApiUrl"
ROUTE = "/orders"
REQUEST_TIMEOUT_SECONDS = 15

REQUIRED_ORDER_FIELDS = {
    "order_id",
    "request_id",
    "location_id",
    "current_stage",
    "status",
    "created_at",
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


def get_json(url: str) -> tuple[int, dict]:
    print(f"GET {url}")
    try:
        with urllib.request.urlopen(url, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            return response.status, json.loads(response.read())
    except urllib.error.HTTPError as exc:
        print(f"Request failed with HTTP {exc.code}:\n{exc.read().decode(errors='replace')}", file=sys.stderr)
        sys.exit(1)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        print(f"Request failed: {exc}", file=sys.stderr)
        sys.exit(1)


def check_page(body: dict) -> None:
    orders = body.get("orders")
    if not isinstance(orders, list):
        print(f"Expected an 'orders' array in the response body, got:\n{json.dumps(body, indent=2)}", file=sys.stderr)
        sys.exit(1)
    if "nextCursor" not in body:
        print(f"Expected a 'nextCursor' key in the response body, got:\n{json.dumps(body, indent=2)}", file=sys.stderr)
        sys.exit(1)

    print(f"  {len(orders)} order(s) on this page, nextCursor={body['nextCursor']!r}")
    for i, item in enumerate(orders[:3]):
        missing = REQUIRED_ORDER_FIELDS - set(item.keys())
        if missing:
            print(f"Order {i} is missing expected field(s): {missing}", file=sys.stderr)
            sys.exit(1)
        print(f"    [{i}] order_id={item['order_id']} stage={item['current_stage']} status={item['status']}")


def main() -> None:
    base_url = get_api_base_url()

    status, body = get_json(f"{base_url}{ROUTE}?limit=5")
    if status != 200:
        print(f"Expected 200, got {status}:\n{body}", file=sys.stderr)
        sys.exit(1)
    check_page(body)

    next_cursor = body.get("nextCursor")
    if next_cursor:
        print("\nFollowing nextCursor to page 2...")
        status, body = get_json(f"{base_url}{ROUTE}?limit=5&cursor={next_cursor}")
        if status != 200:
            print(f"Expected 200 on page 2, got {status}:\n{body}", file=sys.stderr)
            sys.exit(1)
        check_page(body)
    else:
        print("\nOnly one page of Orders exists today — nextCursor was null, nothing further to follow.")

    print("\nFiltering by stage=INGEST...")
    status, body = get_json(f"{base_url}{ROUTE}?limit=20&stage=INGEST")
    if status != 200:
        print(f"Expected 200 for the filtered query, got {status}:\n{body}", file=sys.stderr)
        sys.exit(1)
    check_page(body)
    non_ingest = [o for o in body["orders"] if o.get("current_stage") != "INGEST"]
    if non_ingest:
        print(f"stage=INGEST filter leaked non-INGEST orders: {non_ingest}", file=sys.stderr)
        sys.exit(1)

    print("\nOrders API smoke test PASSED.")


if __name__ == "__main__":
    main()
