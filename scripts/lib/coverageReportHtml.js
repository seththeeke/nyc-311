#!/usr/bin/env node
/**
 * Shared coverage-report rendering, used by both `scripts/rollup-coverage.js`
 * (local dev, links back into each package's own coverage/ directory
 * in-place) and `scripts/publish-coverage.js` (CI, links into a flat
 * staged directory meant for S3). The two differ only in how they resolve
 * `coverageDir` and build each row's link, not in table shape or which
 * metrics/colors are shown — this module owns that shared shape.
 *
 * No dependencies beyond Node's own fs/path — this is repo tooling, not
 * part of any package's build.
 */

const fs = require("node:fs");
const path = require("node:path");

const COVERAGE_GATE_PCT = 90; // testing-framework.md §2 — the per-file gate every package shares.

/**
 * Reads one package's Vitest v8 coverage output. `coverageDir` is the
 * absolute path to that package's own `coverage/` directory.
 */
function readCoverageSummary(coverageDir) {
  const indexPath = path.join(coverageDir, "index.html");
  const summaryPath = path.join(coverageDir, "coverage-summary.json");

  if (!fs.existsSync(indexPath)) {
    return { available: false, summary: null, generatedAt: null };
  }

  let summary = null;
  if (fs.existsSync(summaryPath)) {
    try {
      summary = JSON.parse(fs.readFileSync(summaryPath, "utf8")).total;
    } catch {
      summary = null; // malformed/partial write — report as available but without numbers, not a crash
    }
  }

  return { available: true, summary, generatedAt: fs.statSync(indexPath).mtime };
}

function pctColor(pct) {
  if (pct === undefined || pct === null) return "#888";
  return pct >= COVERAGE_GATE_PCT ? "#1a7f37" : "#c53030";
}

function metricCell(summary, key) {
  if (!summary) return `<td class="metric">—</td>`;
  const pct = summary[key]?.pct;
  return `<td class="metric" style="color:${pctColor(pct)}">${pct}%</td>`;
}

/**
 * `pkg` is `{ name, ...readCoverageSummary() result, hrefWhenAvailable, unavailableHint }`.
 */
function renderRow(pkg) {
  if (!pkg.available) {
    return `
      <tr class="unavailable">
        <td>${pkg.name}</td>
        <td colspan="4">not yet generated — ${pkg.unavailableHint}</td>
        <td>—</td>
      </tr>`;
  }

  const { summary } = pkg;
  return `
      <tr>
        <td><a href="${pkg.hrefWhenAvailable}">${pkg.name}</a></td>
        ${metricCell(summary, "lines")}
        ${metricCell(summary, "branches")}
        ${metricCell(summary, "functions")}
        ${metricCell(summary, "statements")}
        <td class="generated">${pkg.generatedAt.toISOString()}</td>
      </tr>`;
}

/**
 * `title`/`note` are the page heading and the explanatory paragraph under
 * it (each caller phrases the "how do I regenerate this" hint
 * differently — local vs. CI has different regeneration steps).
 */
function renderCoverageReportHtml({ title, note, packages }) {
  const rows = packages.map(renderRow).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 2rem; color: #1a1a1a; }
  h1 { font-size: 1.25rem; }
  p.note { color: #555; font-size: 0.9rem; max-width: 60ch; }
  table { border-collapse: collapse; margin-top: 1rem; width: 100%; max-width: 700px; }
  th, td { text-align: left; padding: 0.5rem 0.9rem; border-bottom: 1px solid #ddd; }
  th { font-size: 0.8rem; text-transform: uppercase; color: #666; }
  td.metric { text-align: right; font-variant-numeric: tabular-nums; }
  td.generated { font-size: 0.8rem; color: #888; white-space: nowrap; }
  tr.unavailable td { color: #999; font-style: italic; }
  a { color: #0969da; text-decoration: none; font-weight: 600; }
  a:hover { text-decoration: underline; }
  code { background: #f2f2f2; padding: 0.1rem 0.35rem; border-radius: 3px; }
</style>
</head>
<body>
<h1>${title}</h1>
<p class="note">${note}</p>
<table>
  <thead>
    <tr>
      <th>Package</th>
      <th>Lines</th>
      <th>Branches</th>
      <th>Functions</th>
      <th>Statements</th>
      <th>Report generated</th>
    </tr>
  </thead>
  <tbody>
${rows}
  </tbody>
</table>
</body>
</html>
`;
}

module.exports = { COVERAGE_GATE_PCT, readCoverageSummary, renderCoverageReportHtml };
