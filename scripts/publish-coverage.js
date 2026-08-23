#!/usr/bin/env node
/**
 * Stages a flat, hosting-ready coverage report at `coverage-publish/` —
 * run by `Nyc311CoveragePublishStep` (cdk/pipeline/) after each
 * environment's deploy, from a CodeBuild workspace where
 * `backend/coverage/`, `cdk/coverage/`, and `web-app/coverage/` have
 * already been placed by CDK Pipelines' `additionalInputs` (the same
 * output `Synth` produced via `npm run test:coverage`, no re-run here).
 *
 * `coverage-publish/index.html` links to `coverage-publish/<pkg>/`, flat
 * and sibling to the index (deliberately not mirroring the repo's own
 * nested `<pkg>/coverage/` layout — that would produce an ugly hosted URL
 * once synced to `s3://<bucket>/coverage/`). Rendering is shared with
 * `scripts/rollup-coverage.js` (the local-dev variant) via
 * `scripts/lib/coverageReportHtml.js`.
 *
 * No dependencies beyond Node's own fs/path — this is repo tooling, not
 * part of any package's build, and isn't gated by CLAUDE.md §2's 90%
 * coverage rule (that applies to backend/, cdk/, web-app/ only).
 */

const fs = require("node:fs");
const path = require("node:path");
const { COVERAGE_GATE_PCT, readCoverageSummary, renderCoverageReportHtml } = require("./lib/coverageReportHtml");

const REPO_ROOT = path.join(__dirname, "..");
const OUTPUT_DIR = path.join(REPO_ROOT, "coverage-publish");

const PACKAGES = [
  { name: "backend", dir: "backend" },
  { name: "cdk", dir: "cdk" },
  { name: "web-app", dir: "web-app" },
];

function stagePackageCoverage(pkg) {
  const sourceDir = path.join(REPO_ROOT, pkg.dir, "coverage");
  const summary = readCoverageSummary(sourceDir);

  if (summary.available) {
    const destDir = path.join(OUTPUT_DIR, pkg.name);
    /*
     * CDK Pipelines' additionalInputs lands each package's coverage/ as a
     * symlink into a CodeBuild-internal source-artifact path (verified via
     * `cdk synth`) — dereference:true is required so this actually copies
     * real file content into coverage-publish/, not a symlink pointing at
     * a path that won't exist once uploaded to S3.
     */
    fs.cpSync(sourceDir, destDir, { recursive: true, dereference: true });
  }

  return {
    ...pkg,
    ...summary,
    hrefWhenAvailable: `./${pkg.name}/index.html`,
    unavailableHint: `"${pkg.dir}/coverage" was empty in this run — check the Synth step's test:coverage output`,
  };
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const packages = PACKAGES.map(stagePackageCoverage);

  const html = renderCoverageReportHtml({
    title: "NYC 311 — Coverage Rollup",
    note: `Links to each package's own Vitest v8 HTML coverage report,
      synced here after every Nyc311Pipeline deploy. Green = at or above
      the ${COVERAGE_GATE_PCT}% per-file gate (testing-framework.md §2);
      this table shows the package-wide average, which can be green even
      if a single file only just clears the per-file threshold.`,
    packages,
  });
  fs.writeFileSync(path.join(OUTPUT_DIR, "index.html"), html);

  console.log(`Staged ${path.relative(REPO_ROOT, OUTPUT_DIR)}`);
  for (const pkg of packages) {
    console.log(
      pkg.available
        ? `  ${pkg.name}: staged (lines ${pkg.summary?.lines?.pct ?? "?"}%)`
        : `  ${pkg.name}: not available`
    );
  }
}

main();
