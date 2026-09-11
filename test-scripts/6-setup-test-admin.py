#!/usr/bin/env python3
"""
Programmatic test-admin provisioning for the pipeline's authenticated
integration test (9-admin-auth-integration.md §8).

Creates (or resets) a dedicated Cognito user in that environment's
Nyc311AdminPool-<env> — separate from the real admin account — with a
freshly generated permanent password, then writes {"email", "password"}
to that environment's Nyc311AdminTestCredential-<env> Secrets Manager
secret. Fully scriptable end to end: AdminSetUserPassword with
--permanent sets the password directly and marks the user CONFIRMED,
skipping the FORCE_CHANGE_PASSWORD challenge a normal sign-up would leave
pending — no console step, no interactive challenge, ever.

Idempotent: safe to re-run. A user that already exists just gets its
password reset (rotated); the secret is created on first run and
overwritten on every later run.

NOT read-only: creates/updates a real Cognito user and a real Secrets
Manager secret in the target environment. A mutating AWS action, so
CLAUDE.md's Deploy Safety Gate applies — confirm before running.

Requires: AWS CLI v2 + a "nyc311" profile with
cloudformation:DescribeStacks, cognito-idp:AdminCreateUser/
AdminSetUserPassword, and secretsmanager:CreateSecret/PutSecretValue
against the target environment's resources.

Usage:
    python3 test-scripts/6-setup-test-admin.py            # Nyc311-Test
    python3 test-scripts/6-setup-test-admin.py --prod      # Nyc311-Prod
"""

import argparse
import json
import secrets
import string
import subprocess
import sys

AWS_PROFILE = "nyc311"
USER_POOL_OUTPUT_KEY = "Nyc311AdminUserPoolId"
TEST_ADMIN_EMAIL = "test-admin@boroughsim.com"
PASSWORD_LENGTH = 20


def aws(*args, allow_failure_substring=None):
    result = subprocess.run(
        ["aws", "--profile", AWS_PROFILE, *args], capture_output=True, text=True
    )
    if result.returncode != 0:
        if allow_failure_substring and allow_failure_substring in result.stderr:
            return None
        print(f"  ! aws {' '.join(args[:2])} failed: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(1)
    return result.stdout


def generate_password():
    # Meets Nyc311AdminAuth's password policy (min 8, upper/lower/digit/symbol) with room to spare.
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    while True:
        candidate = "".join(secrets.choice(alphabet) for _ in range(PASSWORD_LENGTH))
        if (
            any(c.islower() for c in candidate)
            and any(c.isupper() for c in candidate)
            and any(c.isdigit() for c in candidate)
            and any(c in "!@#$%^&*" for c in candidate)
        ):
            return candidate


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--prod", action="store_true", help="target Nyc311-Prod instead of Nyc311-Test")
    args = parser.parse_args()
    stack = "Nyc311-Prod" if args.prod else "Nyc311-Test"
    suffix = "Prod" if args.prod else "Test"
    secret_name = f"Nyc311AdminTestCredential-{suffix}"

    print(f"Looking up {USER_POOL_OUTPUT_KEY} on {stack}...")
    stacks = json.loads(aws("cloudformation", "describe-stacks", "--stack-name", stack))
    outputs = {o["OutputKey"]: o["OutputValue"] for o in stacks["Stacks"][0].get("Outputs", [])}
    user_pool_id = outputs.get(USER_POOL_OUTPUT_KEY)
    if not user_pool_id:
        print(f"FAIL: {stack} has no {USER_POOL_OUTPUT_KEY} output — has Leg 0 been deployed?")
        sys.exit(1)

    print(f"Ensuring test-admin user {TEST_ADMIN_EMAIL} exists in {user_pool_id}...")
    created = aws(
        "cognito-idp", "admin-create-user",
        "--user-pool-id", user_pool_id,
        "--username", TEST_ADMIN_EMAIL,
        "--user-attributes", f"Name=email,Value={TEST_ADMIN_EMAIL}", "Name=email_verified,Value=true",
        "--message-action", "SUPPRESS",
        allow_failure_substring="UsernameExistsException",
    )
    print("  ...created" if created is not None else "  ...already exists, resetting password")

    password = generate_password()
    aws(
        "cognito-idp", "admin-set-user-password",
        "--user-pool-id", user_pool_id,
        "--username", TEST_ADMIN_EMAIL,
        "--password", password,
        "--permanent",
    )
    print("  ...password set (permanent, no FORCE_CHANGE_PASSWORD challenge)")

    secret_value = json.dumps({"email": TEST_ADMIN_EMAIL, "password": password})
    print(f"Writing credential to Secrets Manager secret {secret_name}...")
    put_ok = aws(
        "secretsmanager", "put-secret-value",
        "--secret-id", secret_name,
        "--secret-string", secret_value,
        allow_failure_substring="ResourceNotFoundException",
    )
    if put_ok is None:
        aws(
            "secretsmanager", "create-secret",
            "--name", secret_name,
            "--description", "Test-only Cognito credential for the integration suite's /admin/whoami check.",
            "--secret-string", secret_value,
        )
        print("  ...secret created")
    else:
        print("  ...secret updated")

    print(f"PASS: {TEST_ADMIN_EMAIL} ready in {stack}, credential in {secret_name}")


if __name__ == "__main__":
    main()
