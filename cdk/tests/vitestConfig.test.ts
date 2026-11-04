import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import config from "../vitest.config";

const CDK_ROOT = path.join(__dirname, "..");

/* Top-level dirs that hold no construct source, so never need gating. */
const NON_SOURCE_DIRS = new Set(["node_modules", "tests", "scripts", "cdk.out", "coverage"]);

function containsTypeScript(dir: string): boolean {
  return fs.readdirSync(dir, { withFileTypes: true }).some((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? containsTypeScript(full) : entry.name.endsWith(".ts");
  });
}

function sourceDirs(): string[] {
  return fs
    .readdirSync(CDK_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && !NON_SOURCE_DIRS.has(entry.name))
    .filter((entry) => containsTypeScript(path.join(CDK_ROOT, entry.name)))
    .map((entry) => entry.name)
    .sort();
}

/*
 * Guards #159: agents/ and teamChat/ (and before them step-function/ and
 * warehouse/) shipped without a coverage.include glob, so their files sat
 * outside the 90%-per-file gate and a regression there passed CI silently.
 */
describe("vitest.config coverage.include", () => {
  it("gates every top-level cdk/ source directory", () => {
    const include = config.test?.coverage?.include ?? [];

    const ungated = sourceDirs().filter((dir) => !include.includes(`${dir}/**/*.ts`));

    expect(ungated).toEqual([]);
  });
});
