#!/usr/bin/env python3
"""
Manual on-demand verification of the capacity CRUD routes
(10-capacity-modeling-and-integration.md §2.1) against a live deployed
environment. Deliberately NOT part of the pipeline's automatic integration
gate — that gate stays GET/read-only by design, so deploys never mutate
real capacity rows as a side effect; this script is the on-demand
alternative for actually exercising the mutating routes end to end.

Signs in as the dedicated test-admin Cognito user
(test-scripts/6-setup-test-admin.py provisions it), then: POST /capacity
(add one throwaway vehicle), GET /capacity (confirm it appears, ACTIVE and
IDLE), DELETE /capacity/{operator_id} (remove it), GET /capacity again
(confirm it's gone from the active roster). Net effect on the target
environment's fleet size: zero.

Requires: AWS CLI v2 + a "nyc311" profile with cloudformation:DescribeStacks,
secretsmanager:GetSecretValue, and cognito-idp:InitiateAuth against the
target environment's resources.

Usage:
    python3 test-scripts/8-capacity-crud-test.py            # Nyc311-Test
    python3 test-scripts/8-capacity-crud-test.py --prod      # Nyc311-Prod
"""

import argparse
import json
import subprocess
import sys
import urllib.error
import urllib.request

AWS_PROFILE = "nyc311"


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


def call_api(method, url, id_token=None, body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {"Authorization": f"Bearer {id_token}"} if id_token else {}
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body_text = e.read().decode()
        return e.code, (json.loads(body_text) if body_text else {})


def expect(condition, message):
    if not condition:
        print(f"FAIL: {message}")
        sys.exit(1)
    print(f"  ...{message}")


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

    print("401 check — GET /capacity with no token...")
    status, _ = call_api("GET", f"{api_url}/capacity")
    expect(status == 401, f"GET /capacity with no token returned {status} (expected 401)")

    print("Create — POST /capacity...")
    status, created = call_api(
        "POST", f"{api_url}/capacity", id_token, {"name": "CRUD Test Vehicle", "rate_per_hour": 12.34}
    )
    expect(status == 201, f"POST /capacity returned {status} (expected 201)")
    expect(created["status"] == "ACTIVE" and created["current_activity"] == "IDLE", "new Operator is ACTIVE/IDLE")
    expect(created["name"] == "CRUD Test Vehicle", "name round-tripped")
    expect(created["rate_per_hour"] == 12.34, "rate_per_hour round-tripped")
    operator_id = created["operator_id"]

    print("Read — GET /capacity shows the new Operator in the active roster...")
    status, status_body = call_api("GET", f"{api_url}/capacity", id_token)
    expect(status == 200, f"GET /capacity returned {status} (expected 200)")
    roster_ids = [o["operator_id"] for o in status_body["roster"]]
    expect(operator_id in roster_ids, f"{operator_id} present in the active roster")

    print("Update (remove) — DELETE /capacity/{operator_id}...")
    status, removed = call_api("DELETE", f"{api_url}/capacity/{operator_id}", id_token)
    expect(status == 200, f"DELETE /capacity/{{operator_id}} returned {status} (expected 200)")
    expect(removed["status"] == "INACTIVE", "removed Operator is INACTIVE")

    print("Read — GET /capacity no longer shows it...")
    status, status_body = call_api("GET", f"{api_url}/capacity", id_token)
    roster_ids = [o["operator_id"] for o in status_body["roster"]]
    expect(operator_id not in roster_ids, f"{operator_id} absent from the active roster")

    print("400 check — DELETE the same operator_id again (already removed)...")
    status, _ = call_api("DELETE", f"{api_url}/capacity/{operator_id}", id_token)
    expect(status == 400, f"re-removing an already-removed Operator returned {status} (expected 400)")

    print("404 check — DELETE a nonexistent operator_id...")
    status, _ = call_api("DELETE", f"{api_url}/capacity/01DOES-NOT-EXIST", id_token)
    expect(status == 404, f"removing a nonexistent operator_id returned {status} (expected 404)")

    print("PASS: capacity CRUD verified end-to-end, net fleet-size change zero")


if __name__ == "__main__":
    main()
