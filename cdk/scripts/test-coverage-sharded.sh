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

set -euo pipefail

SHARD_COUNT=3
DISABLE_PER_SHARD_THRESHOLDS=(
  --coverage.thresholds.lines=0
  --coverage.thresholds.branches=0
  --coverage.thresholds.functions=0
  --coverage.thresholds.statements=0
)

rm -rf .vitest-reports coverage

for shard in $(seq 1 "$SHARD_COUNT"); do
  npx vitest run --shard="${shard}/${SHARD_COUNT}" --reporter=blob --coverage "${DISABLE_PER_SHARD_THRESHOLDS[@]}"
done

# The real threshold check: reads all 3 shards' coverage data together.
npx vitest run --mergeReports --coverage
