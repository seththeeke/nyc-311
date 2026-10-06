#!/usr/bin/env bash
#
# CI-only alternative to `npm run test:coverage` for cdk/ — added 2026-08-28
# after this package's test suite started deterministically hitting a
# hardcoded 60s Vitest internal RPC timeout ("[vitest-worker]: Timeout
# calling 'onTaskUpdate'") during CodeBuild's Synth step. Root cause: a
# single vitest process running all ~30 test files serially has to
# serialize and transmit its full v8 coverage payload back to the main
# process in one shot at worker teardown; that one operation exceeded
# Vitest's fixed (not configurable) 60s ceiling even on LARGE CodeBuild
# compute — the bottleneck isn't CPU, it's the size of that single
# transfer. Splitting the SAME 30 files across 3 independent `vitest run`
# processes (Vitest's own built-in --shard mechanism) means each process
# only carries ~1/3 the coverage payload, well under the ceiling.
#
# This does NOT weaken the coverage gate. Every test file still runs
# exactly once, coverage is still collected for every line, and the real
# 90%-per-file threshold (cdk/vitest.config.ts) is still enforced --- just
# deferred to the final --mergeReports step, which is the only point a
# complete picture across all three shards exists. Each shard run passes
# --coverage.thresholds.*=0 to skip a threshold check against its own
# necessarily-partial 1/3 of the coverage data (which would otherwise fail
# for files whose tests happen to land in a different shard) -- this is
# the same reporting mechanism (@vitest/coverage-v8), the same thresholds
# object from the same config file, just checked once instead of three
# times against fake partial numbers.
#
# `npm run test:coverage` (unsharded) stays the local-dev default --- this
# problem has only ever reproduced on CodeBuild, never locally.
#
# SHARD_COUNT bumped 3 -> 6 on 2026-09-12: the suite grew from ~30 to 54
# test files (10-capacity-modeling-and-integration.md Legs 1-2 --- three
# new NodejsFunction-bundling Lambda test files plus a new table's), which
# regrew each shard's coverage payload back toward the same fixed 60s
# ceiling this script exists to dodge -- confirmed via 4 consecutive
# identical CodeBuild "onTaskUpdate" failures at SHARD_COUNT=3 the same
# day. Tried 5 first: a local sharded run passed, but the slowest shard
# still took 51s -- too close to the 60s ceiling to trust on CodeBuild's
# more variable performance. 6 gives real headroom, not just a bare pass.
#
# Switched 2026-09-29 (#34) from Vitest's own --shard=i/N (a contiguous
# slice of the alphabetically-sorted file list, blind to duration) to
# scripts/plan-shards.ts's duration-aware bin-packing: measured locally,
# the alphabetical split ranged 7.2s-22.7s per shard (3.15x spread) even
# though every shard has the same file count -- one unlucky shard was
# always closer to the 60s ceiling than the others for no reason tied to
# suite size. The packed plan ranges 17.1s-17.3s (near-perfectly even),
# cutting the worst-case shard by ~24% without changing total test count,
# coverage collected, or the merge-time threshold check below.

#
# Shards run concurrently (2026-10, #9): each is its own vitest process
# with maxForks=1, so the per-process RPC payload that the header above
# is about is unchanged. Serially they cost ~57s wall-clock locally; in
# parallel ~19s. Each shard writes coverage to its own reportsDirectory
# because vitest's v8 provider wipes and rewrites a shared coverage/.tmp
# on every run, so concurrent shards would delete each other's data.

set -uo pipefail
# No `-e`: every shard's exit status is captured and reported explicitly
# below. `--reporter=blob` alone suppresses Vitest's normal pass/fail
# summary, which made a real 2026-08-28 CI failure impossible to diagnose
# from the CodeBuild log; `--reporter=default` restores it alongside
# blob's merge data.

# SHARD_COUNT itself now lives in scripts/plan-shards.ts, next to the
# packing logic that depends on it — read the plan's line count below
# rather than duplicating the constant here.

# One fork per shard process. The "onTaskUpdate" worker-RPC timeout this
# whole script exists to dodge is a CodeBuild-only, parallelism-sensitive
# failure (see header); vitest.config.ts now runs bounded-parallel for
# local dev, so CI re-pins serial here rather than there. Keep in sync
# with the note in vitest.config.ts's pool comment.
SERIAL_POOL=(
  --poolOptions.forks.maxForks=1
  --poolOptions.forks.minForks=1
)

DISABLE_PER_SHARD_THRESHOLDS=(
  --coverage.thresholds.lines=0
  --coverage.thresholds.branches=0
  --coverage.thresholds.functions=0
  --coverage.thresholds.statements=0
)

rm -rf .vitest-reports coverage
mkdir -p coverage

# Reads plan-shards.ts's stdout (one shard's space-separated file list per
# line) into an array without relying on `mapfile` (bash 4+ only —
# CodeBuild's image has it, but this avoids a silent local-macOS/bash-3.2
# failure for anyone running this script by hand).
SHARD_FILE_LISTS=()
while IFS= read -r line; do
  SHARD_FILE_LISTS+=("$line")
done < <(npx ts-node --prefer-ts-exts scripts/plan-shards.ts)
SHARD_COUNT=${#SHARD_FILE_LISTS[@]}

SHARD_PIDS=()
for i in "${!SHARD_FILE_LISTS[@]}"; do
  shard=$((i + 1))
  echo "=== Shard ${shard}/${SHARD_COUNT} starting (concurrent) ==="
  # Vitest's blob reporter only auto-names its output per-shard when its
  # own --shard flag is set (`.vitest-reports/blob-<i>-<n>.json`); since
  # this script now picks each shard's explicit file list instead, every
  # invocation would otherwise write the same `blob.json` and silently
  # clobber the previous shard's data before --mergeReports ever runs.
  # Output goes to a per-shard log (not the terminal) so six interleaved
  # streams don't mix; logs are printed in order below. Logs live under
  # coverage/ (not .vitest-reports/, which --mergeReports reads in full).
  # shellcheck disable=SC2086  # intentional word-splitting: a shard's file list
  npx vitest run ${SHARD_FILE_LISTS[$i]} --reporter=default --reporter=blob --outputFile.blob=".vitest-reports/blob-${shard}.json" --coverage --coverage.reportsDirectory="coverage/shard-${shard}" "${SERIAL_POOL[@]}" "${DISABLE_PER_SHARD_THRESHOLDS[@]}" > "coverage/shard-${shard}.log" 2>&1 &
  SHARD_PIDS+=($!)
done

FAILED=0
for i in "${!SHARD_PIDS[@]}"; do
  shard=$((i + 1))
  wait "${SHARD_PIDS[$i]}"
  status=$?
  cat "coverage/shard-${shard}.log"
  echo "=== Shard ${shard}/${SHARD_COUNT} exited with status ${status} ==="
  if [ "$status" -ne 0 ]; then
    FAILED=1
  fi
done

if [ "$FAILED" -ne 0 ]; then
  echo "One or more shards failed — aborting before merge."
  exit 1
fi

# The real threshold check: reads all shards' coverage data together.
echo "=== Merging shard reports and checking the real coverage thresholds ==="
npx vitest run --mergeReports --coverage
