#!/usr/bin/env python3
"""
Polls Nyc311Pipeline every 15s and reports each stage's status for the
pipeline execution triggered by the latest push. Prints a line every
interval regardless of change, so a live observer knows it's still alive.
Exits 0 once DeployTest succeeds for that execution, 1 on failure/timeout.
"""

import json
import subprocess
import sys
import time
from datetime import datetime, timezone

PROFILE = "nyc311"
PIPELINE_NAME = "Nyc311Pipeline"
INTERVAL_SECONDS = 15
MAX_ITERATIONS = 100  # ~25 minutes


def run_aws(args: list[str]):
    result = subprocess.run(
        ["aws", *args, "--profile", PROFILE, "--output", "json"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"[aws-cli-error] {' '.join(args)}: {result.stderr.strip()}", flush=True)
        return None
    stdout = result.stdout.strip()
    return json.loads(stdout) if stdout else {}


def pick_target_execution_id() -> str | None:
    data = run_aws(
        ["codepipeline", "list-pipeline-executions", "--pipeline-name", PIPELINE_NAME, "--max-items", "5"]
    )
    if not data:
        return None
    summaries = data.get("pipelineExecutionSummaries", [])
    if not summaries:
        return None
    in_progress = [s for s in summaries if s.get("status") == "InProgress"]
    target = in_progress[0] if in_progress else summaries[0]
    print(
        f"Watching pipeline execution {target['pipelineExecutionId']} "
        f"(status={target.get('status')}, started={target.get('startTime')})",
        flush=True,
    )
    return target["pipelineExecutionId"]


def main() -> None:
    target_id = pick_target_execution_id()
    if not target_id:
        print("Could not determine the current pipeline execution — nothing to watch.", flush=True)
        sys.exit(1)

    for _ in range(MAX_ITERATIONS):
        state = run_aws(["codepipeline", "get-pipeline-state", "--name", PIPELINE_NAME])
        timestamp = datetime.now(timezone.utc).strftime("%H:%M:%S")

        if state is None:
            print(f"[{timestamp}] (retrying after AWS CLI error)", flush=True)
            time.sleep(INTERVAL_SECONDS)
            continue

        parts = []
        deploy_test_status = None
        deploy_test_is_target = False
        any_target_failed = False

        for stage in state.get("stageStates", []):
            name = stage.get("stageName")
            latest = stage.get("latestExecution", {})
            status = latest.get("status", "Unknown")
            is_target = latest.get("pipelineExecutionId") == target_id
            marker = "*" if is_target else " "
            parts.append(f"{name}={status}{marker}")

            if is_target and status == "Failed":
                any_target_failed = True
            if name == "DeployTest":
                deploy_test_status = status
                deploy_test_is_target = is_target

        print(f"[{timestamp}] {' | '.join(parts)}  (* = this execution)", flush=True)

        if any_target_failed:
            print("RESULT: a stage in this execution FAILED. Stopping — check the pipeline console.", flush=True)
            sys.exit(1)

        if deploy_test_is_target and deploy_test_status == "Succeeded":
            print("RESULT: DeployTest succeeded for this execution — Test environment is deployed.", flush=True)
            sys.exit(0)

        time.sleep(INTERVAL_SECONDS)

    print(f"RESULT: timed out after {MAX_ITERATIONS * INTERVAL_SECONDS}s waiting for DeployTest.", flush=True)
    sys.exit(1)


if __name__ == "__main__":
    main()
