#!/usr/bin/env python3
"""
Seeds the vehicle fleet up to 10 units (10-capacity-modeling-and-integration.md
§1.3) by calling the real, admin-authorized POST /capacity endpoint — not a
separate seeding code path. Idempotent: tops up to a fleet of 10 rather than
always adding 10 more, so re-running it after a partial seed (or just to
confirm the fleet is still at target) is safe.

Signs in as the dedicated test-admin Cognito user
(test-scripts/6-setup-test-admin.py provisions it) via Cognito's
InitiateAuth, the same USER_PASSWORD_AUTH flow the pipeline's integration
suite uses.

NOT read-only: creates real Operator rows (and their OPERATOR_ADDED events)
in the target environment's Operators table via the live API. Capacity
mutations are deliberately kept out of the pipeline's automatic integration
gate (10-capacity-modeling-and-integration.md §8-equivalent reasoning) — this
script is the on-demand alternative.

Requires: AWS CLI v2 + a "nyc311" profile with cloudformation:DescribeStacks,
secretsmanager:GetSecretValue, and cognito-idp:InitiateAuth against the
target environment's resources.

Usage:
    python3 test-scripts/7-seed-capacity.py            # Nyc311-Test
    python3 test-scripts/7-seed-capacity.py --prod      # Nyc311-Prod
    python3 test-scripts/7-seed-capacity.py --target 5  # seed to a different fleet size
"""

import argparse
import json
import subprocess
import sys
import urllib.error
import urllib.request

AWS_PROFILE = "nyc311"
DEFAULT_TARGET_FLEET_SIZE = 10


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
    parser.add_argument("--target", type=int, default=DEFAULT_TARGET_FLEET_SIZE, help="target fleet size (default 10)")
    args = parser.parse_args()
    stack = "Nyc311-Prod" if args.prod else "Nyc311-Test"
    suffix = "Prod" if args.prod else "Test"

    print(f"Looking up API URL and User Pool client on {stack}...")
    api_url = stack_output(stack, "Nyc311ApiUrl").rstrip("/")
    client_id = stack_output(stack, "Nyc311AdminUserPoolClientId")

    print("Signing in as the test-admin...")
    id_token = get_id_token(client_id, f"Nyc311AdminTestCredential-{suffix}")

    print("Checking current fleet size...")
    status, body = call_api("GET", f"{api_url}/capacity", id_token)
    if status != 200:
        print(f"FAIL: GET /capacity returned {status}: {body}")
        sys.exit(1)
    current_fleet_size = body["fleet_size"]
    to_add = max(0, args.target - current_fleet_size)
    print(f"  ...fleet_size={current_fleet_size}, target={args.target}, adding {to_add}")

    for i in range(to_add):
        name = f"Vehicle {current_fleet_size + i + 1}"
        status, body = call_api("POST", f"{api_url}/capacity", id_token, {"name": name})
        if status != 201:
            print(f"FAIL: POST /capacity returned {status}: {body}")
            sys.exit(1)
        print(f"  ...added {body['operator_id']} ({body['name']}, rate ${body['rate_per_hour']}/hr)")

    status, body = call_api("GET", f"{api_url}/capacity", id_token)
    print(f"PASS: fleet_size={body['fleet_size']}, hourly_burn_rate=${body['hourly_burn_rate']}")


if __name__ == "__main__":
    main()
