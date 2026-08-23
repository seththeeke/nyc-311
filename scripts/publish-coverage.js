#!/usr/bin/env node
/**
 * Merges backend/, cdk/, and web-app/'s separate Vitest v8 coverage runs
 * (`coverage-final.json`, Istanbul's coverage-map format — v8 provider
 * writes it in the same shape) into ONE coverage map, then generates a
 * single Istanbul HTML report tree from it at `coverage-publish/` — one
 * navigable report covering every file in the repo, not three separate
 * per-package reports linked from a summary page.
 *
 * Run by `Nyc311CoveragePublishStep` (cdk/pipeline/) after each
 * environment's deploy, from a CodeBuild workspace where
 * `backend/coverage/`, `cdk/coverage/`, and `web-app/coverage/` have
 * already been placed by CDK Pipelines' `additionalInputs` (the same
 * output `Synth` produced via `npm run test:coverage`, no re-run here),
 * and the full repo checked out via `input` (so real source files are on
 * disk for the HTML report's syntax-highlighted line view — see
 * `sourceFinder` below for why that needs a path rewrite).
 */

const fs = require("node:fs");
const path = require("node:path");
const libCoverage = require("istanbul-lib-coverage");
const libReport = require("istanbul-lib-report");
const reports = require("istanbul-reports");

const REPO_ROOT = path.join(__dirname, "..");
const OUTPUT_DIR = path.join(REPO_ROOT, "coverage-publish");
const PACKAGE_DIRS = ["backend", "cdk", "web-app"];

function loadCoverageFinal(pkgDir) {
  const file = path.join(REPO_ROOT, pkgDir, "coverage", "coverage-final.json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/*
 * `coverage-final.json`'s file paths are absolute, rooted at wherever
 * Synth's CodeBuild container checked the repo out (e.g.
 * `/codebuild/output/srcNNNN/src/backend/dao/...`) — a different
 * container from this one, so that exact path won't exist here. Every
 * recorded path still contains one of the three package directory names
 * as a segment, though, so resolving from there against this container's
 * own REPO_ROOT finds the real, current file.
 */
function sourceFinder(filePath) {
  const match = PACKAGE_DIRS.map((dir) => `/${dir}/`)
    .map((marker) => ({ marker, index: filePath.indexOf(marker) }))
    .filter((m) => m.index !== -1)
    .sort((a, b) => a.index - b.index)[0];

  if (!match) {
    throw new Error(`Coverage path "${filePath}" doesn't contain a known package directory`);
  }

  const repoRelativePath = filePath.slice(match.index + 1);
  return fs.readFileSync(path.join(REPO_ROOT, repoRelativePath), "utf8");
}

function main() {
  const coverageMap = libCoverage.createCoverageMap({});
  const missingPackages = [];

  for (const pkgDir of PACKAGE_DIRS) {
    const data = loadCoverageFinal(pkgDir);
    if (data) {
      coverageMap.merge(data);
    } else {
      missingPackages.push(pkgDir);
    }
  }

  if (coverageMap.files().length === 0) {
    throw new Error("No coverage-final.json found for any package — nothing to publish");
  }

  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const context = libReport.createContext({
    dir: OUTPUT_DIR,
    coverageMap,
    sourceFinder,
    /*
     * "nested" strips the common ancestor across every merged file (the
     * Synth container's checkout root) and builds a real directory tree
     * from what's left — backend/, cdk/, web-app/ each as a top-level
     * node with their own file tree beneath, all under one index.html.
     */
    defaultSummarizer: "nested",
  });

  reports.create("html", {}).execute(context);

  console.log(`Published a merged report covering ${coverageMap.files().length} files to coverage-publish/`);
  if (missingPackages.length > 0) {
    console.log(`  missing coverage-final.json for: ${missingPackages.join(", ")}`);
  }
}

main();
