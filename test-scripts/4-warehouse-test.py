#!/usr/bin/env python3
"""
Manual data-warehouse landing smoke test against the Test environment
(7-data-warehousing.md §5-§7, Leg 2).

Writes one synthetic OrderEvent row directly into Orders-Test, waits out
the Firehose buffer (~300s), then runs an Athena query against
nyc311_warehouse_test.order_events and confirms the row landed.

NOT read-only: writes a synthetic EVENT# item into Orders-Test (a fake
order_id prefixed WAREHOUSE-TEST-) and runs an Athena query (a few cents
at most). The synthetic Order has no #METADATA projection, so it never
enters the evaluation/scheduling pipeline — it's inert apart from the
fan-out.

Requires: AWS CLI v2 + a "nyc311" profile with dynamodb:PutItem on
Orders-Test and athena:StartQueryExecution/GetQueryExecution/
GetQueryResults on the Nyc311Analytics-Test workgroup.

Usage:
    python3 test-scripts/4-warehouse-test.py
"""

import json
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone

AWS_PROFILE = "nyc311"
ORDERS_TABLE = "Orders-Test"
WORKGROUP = "Nyc311Analytics-Test"
DATABASE = "nyc311_warehouse_test"

FIREHOSE_BUFFER_WAIT_SECONDS = 330
ATHENA_POLL_INTERVAL_SECONDS = 3
ATHENA_MAX_WAIT_SECONDS = 120


def aws(*args):
    result = subprocess.run(
        ["aws", "--profile", AWS_PROFILE, *args],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"  ! aws {' '.join(args[:2])} failed: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(1)
    return result.stdout


def main():
    order_id = f"WAREHOUSE-TEST-{uuid.uuid4()}"
    occurred_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    print(f"Writing synthetic OrderEvent: order_id={order_id}")

    item = {
        "order_id": {"S": order_id},
        "sk": {"S": "EVENT#0"},
        "sequence_number": {"N": "0"},
        "event_type": {"S": "ORDER_CREATED"},
        "stage": {"NULL": True},
        "actor": {"S": "SYSTEM"},
        "occurred_at": {"S": occurred_at},
        "payload": {"M": {"request_id": {"S": "WAREHOUSE-TEST-REQ"}, "location_id": {"S": "1000000000"}}},
    }
    aws("dynamodb", "put-item", "--table-name", ORDERS_TABLE, "--item", json.dumps(item))

    print(f"Waiting {FIREHOSE_BUFFER_WAIT_SECONDS}s for the Firehose buffer to flush to S3 (slow by design)...")
    time.sleep(FIREHOSE_BUFFER_WAIT_SECONDS)

    query = (
        f"SELECT order_id, event_type, ingestion_source FROM {DATABASE}.order_events "
        f"WHERE order_id = '{order_id}' AND dt >= date_format(current_date, '%Y-%m-%d')"
    )
    print(f"Running Athena query in workgroup {WORKGROUP}...")
    start = json.loads(
        aws(
            "athena",
            "start-query-execution",
            "--query-string",
            query,
            "--work-group",
            WORKGROUP,
            "--query-execution-context",
            f"Database={DATABASE}",
        )
    )
    qid = start["QueryExecutionId"]

    waited = 0
    while waited < ATHENA_MAX_WAIT_SECONDS:
        exec_info = json.loads(aws("athena", "get-query-execution", "--query-execution-id", qid))
        state = exec_info["QueryExecution"]["Status"]["State"]
        if state in ("SUCCEEDED", "FAILED", "CANCELLED"):
            break
        time.sleep(ATHENA_POLL_INTERVAL_SECONDS)
        waited += ATHENA_POLL_INTERVAL_SECONDS

    if state != "SUCCEEDED":
        reason = exec_info["QueryExecution"]["Status"].get("StateChangeReason", "")
        print(f"FAIL: Athena query {state}: {reason}")
        sys.exit(1)

    results = json.loads(aws("athena", "get-query-results", "--query-execution-id", qid))
    rows = results["ResultSet"]["Rows"]
    # rows[0] is the header
    if len(rows) < 2:
        print("FAIL: the synthetic OrderEvent did not land in order_events (0 rows)")
        sys.exit(1)

    data = [c.get("VarCharValue") for c in rows[1]["Data"]]
    print(f"PASS: row landed -> {data}")
    if data[2] != "STREAM":
        print(f"WARN: ingestion_source is {data[2]!r}, expected 'STREAM'")


if __name__ == "__main__":
    main()
