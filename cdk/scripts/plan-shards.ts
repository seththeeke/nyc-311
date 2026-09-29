/**
 * Duration-aware bin-packing shard planner for cdk/'s CI suite (#34).
 * Vitest's --shard slices the alphabetical file list blind to duration,
 * unbalancing shard wall time even without suite growth. Packs
 * shard-timings.json's measured durations into SHARD_COUNT buckets via
 * Longest-Processing-Time: sort descending, add each file to the
 * lightest shard. An un-measured file defaults to the median, not free.
 * Prints one shard's file list per line, for test-coverage-sharded.sh.
 */
import * as fs from "node:fs";
import * as path from "node:path";

const SHARD_COUNT = 6;
const CDK_ROOT = path.join(__dirname, "..");
const TESTS_DIR = path.join(CDK_ROOT, "tests");
const TIMINGS_PATH = path.join(__dirname, "shard-timings.json");

interface Shard {
  files: string[];
  total: number;
}

function listTestFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listTestFiles(full));
    } else if (entry.name.endsWith(".test.ts")) {
      out.push(path.relative(CDK_ROOT, full).split(path.sep).join("/"));
    }
  }
  return out;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function planShards(files: string[], timings: Record<string, number>, shardCount: number): Shard[] {
  const known = files
    .map((file) => timings[file])
    .filter((duration): duration is number => typeof duration === "number");
  const fallback = known.length > 0 ? median(known) : 1000;
  const withDurations = files
    .map((file) => ({ file, duration: timings[file] ?? fallback }))
    .sort((a, b) => b.duration - a.duration);

  const shards: Shard[] = Array.from({ length: shardCount }, () => ({ files: [], total: 0 }));
  for (const { file, duration } of withDurations) {
    const lightest = shards.reduce((min, shard) => (shard.total < min.total ? shard : min), shards[0]);
    lightest.files.push(file);
    lightest.total += duration;
  }
  return shards;
}

function main(): void {
  const files = listTestFiles(TESTS_DIR);
  const timings: Record<string, number> = fs.existsSync(TIMINGS_PATH)
    ? JSON.parse(fs.readFileSync(TIMINGS_PATH, "utf8"))
    : {};
  const shards = planShards(files, timings, SHARD_COUNT);
  for (const shard of shards) {
    process.stdout.write(`${shard.files.join(" ")}\n`);
  }
}

main();
