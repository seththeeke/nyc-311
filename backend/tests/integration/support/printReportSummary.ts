import { mergePartialsIntoReport, resetReport } from "./routeTracker";

/**
 * Vitest globalSetup (`vitest.integration.config.ts`). `setup` clears the
 * prior run's partials and writes a not-yet-hit skeleton so the pipeline's
 * sync step always finds a route-report.json. `teardown` folds the
 * per-route partials into the final route-report.json and prints the
 * route-hit summary (4-pipeline-integration-tests.md §4). Runs in a
 * separate context from the test files — shares state only via the
 * on-disk partials.
 */

export async function setup(): Promise<void> {
  resetReport();
}

export async function teardown(): Promise<void> {
  const report = mergePartialsIntoReport();

  console.log(`\nIntegration test route report — target=${report.target}, ranAt=${report.ranAt}`);
  console.log(`${"Route".padEnd(24)}${"Hit".padEnd(6)}Status`);
  for (const [route, entry] of Object.entries(report.routes)) {
    const status = entry.hit ? String(entry.statusCode) : "-";
    console.log(`${route.padEnd(24)}${(entry.hit ? "yes" : "no").padEnd(6)}${status}`);
  }
}
