/**
 * Regenerates shard-timings.json, the calibration data plan-shards.ts
 * bin-packs against (#34). Run by hand when the suite's timing profile
 * has likely shifted -- not part of CI. Runs the suite once, single-
 * forked so hook time (a cached-per-environment `cdk synth`) isn't
 * diluted by concurrent forks, and parses each file's total from
 * Vitest's default reporter -- its JSON reporter excludes
 * beforeAll/afterAll hook time, which is most of the cost here.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const CDK_ROOT = path.join(__dirname, "..");
const OUT_PATH = path.join(__dirname, "shard-timings.json");
const FILE_LINE = /^ ✓ (tests\/\S+) \(\d+ tests?\) (\d+)ms$/;

function main(): void {
  const output = execFileSync(
    "npx",
    ["vitest", "run", "--reporter=default", "--poolOptions.forks.maxForks=1", "--poolOptions.forks.minForks=1"],
    { cwd: CDK_ROOT, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
  );

  const timings: Record<string, number> = {};
  for (const line of output.split("\n")) {
    const match = FILE_LINE.exec(line);
    if (match) timings[match[1]] = Number(match[2]);
  }

  fs.writeFileSync(OUT_PATH, `${JSON.stringify(timings, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(timings).length} file timings to ${OUT_PATH}`);
}

main();
