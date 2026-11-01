#!/usr/bin/env python3
"""
agent-credentials.py create <agent> <TEST|PROD> [--group GROUP ...] [--admin-profile nyc311]

Gives an agent its Team Chat sign-in (docs/agent-automation-setup.md,
"Team Chat for an agent"). Run it on an admin machine:
  1. Creates the Cognito user <agent>@agents.boroughsim.com in that
     environment's admin pool, with no email sent, or reuses it if it exists.
  2. Generates a password and sets it as permanent.
  3. Adds the user to BOROUGH_SIM_TEAM, plus any --group (the COO also needs
     BOROUGH_SIM_OPERATIONS).
  4. Saves the password to ~/.nyc-311/credentials (directory 700, file 600)
     under [<agent>] as test_password / prod_password.
Copy that file to the Mac mini, where scripts/agent-team-chat-config.sh reads
it. The password is never printed. Re-running rotates it.
"""
import argparse
import configparser
import os
import secrets
import string
import subprocess
import sys

REGION = "us-east-1"
CREDENTIALS_DIR = os.path.expanduser("~/.nyc-311")
CREDENTIALS_FILE = os.path.join(CREDENTIALS_DIR, "credentials")
SUFFIX = {"TEST": "Test", "PROD": "Prod"}


def aws(profile: str, *args: str) -> str:
    result = subprocess.run(["aws", "--profile", profile, "--region", REGION, *args], capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip())
    return result.stdout.strip()


def new_password() -> str:
    """32 random characters, guaranteed to meet the pool's upper/lower/digit/symbol policy."""
    alphabet = string.ascii_letters + string.digits + "!#*+-_"
    while True:
        pw = "".join(secrets.choice(alphabet) for _ in range(32))
        if any(c.islower() for c in pw) and any(c.isupper() for c in pw) and any(c.isdigit() for c in pw) and any(c in "!#*+-_" for c in pw):
            return pw


def save(agent: str, env: str, password: str) -> None:
    os.makedirs(CREDENTIALS_DIR, mode=0o700, exist_ok=True)
    os.chmod(CREDENTIALS_DIR, 0o700)
    config = configparser.ConfigParser(interpolation=None)
    config.read(CREDENTIALS_FILE)
    if not config.has_section(agent):
        config.add_section(agent)
    config.set(agent, f"{env.lower()}_password", password)
    fd = os.open(CREDENTIALS_FILE, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as handle:
        config.write(handle)
    os.chmod(CREDENTIALS_FILE, 0o600)


def create(agent: str, env: str, groups: list[str], profile: str) -> None:
    email = f"{agent}@agents.boroughsim.com"
    pool = aws(profile, "ssm", "get-parameter", "--name", f"/Nyc311/{SUFFIX[env]}/AdminPool/UserPoolId", "--query", "Parameter.Value", "--output", "text")
    try:
        aws(profile, "cognito-idp", "admin-get-user", "--user-pool-id", pool, "--username", email)
        print(f"{email} already exists in {env}; rotating its password")
    except RuntimeError:
        aws(profile, "cognito-idp", "admin-create-user", "--user-pool-id", pool, "--username", email,
            "--user-attributes", f"Name=email,Value={email}", "Name=email_verified,Value=true", "--message-action", "SUPPRESS")
        print(f"created {email} in {env} ({pool})")
    password = new_password()
    aws(profile, "cognito-idp", "admin-set-user-password", "--user-pool-id", pool, "--username", email, "--password", password, "--permanent")
    for group in ["BOROUGH_SIM_TEAM", *groups]:
        aws(profile, "cognito-idp", "admin-add-user-to-group", "--user-pool-id", pool, "--username", email, "--group-name", group)
        print(f"  in {group}")
    save(agent, env, password)
    print(f"  password saved to {CREDENTIALS_FILE} [{agent}] {env.lower()}_password")


def main() -> int:
    parser = argparse.ArgumentParser(description="Create an agent's Team Chat sign-in and save it locally.")
    sub = parser.add_subparsers(dest="command", required=True)
    cmd = sub.add_parser("create")
    cmd.add_argument("agent", help="e.g. devx-agent, coo-agent")
    cmd.add_argument("env", choices=["TEST", "PROD"])
    cmd.add_argument("--group", action="append", default=[], help="an extra Cognito group, e.g. BOROUGH_SIM_OPERATIONS")
    cmd.add_argument("--admin-profile", default="nyc311")
    args = parser.parse_args()
    try:
        create(args.agent, args.env, args.group, args.admin_profile)
    except Exception as err:  # noqa: BLE001 - never let a traceback print a password
        print(f"agent-credentials: {type(err).__name__}: {err if isinstance(err, RuntimeError) else 'failed (details withheld so no secret is printed)'}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
