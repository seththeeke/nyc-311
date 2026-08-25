import { readCurrentReport } from "./routeTracker";

/**
 * Vitest globalSetup file (`vitest.integration.config.ts`) — `setup` is
 * required by Vitest's contract even though there's nothing to do before
 * the run; `teardown` prints the route-hit console summary
 * (4-pipeline-integration-tests.md §4) once after every test file has
 * finished, reading back whatever `routeTracker.ts` wrote to disk during
 * the run (this file runs in a separate context from the test files, so
 * it can't share in-memory state with them — only the file on disk).
 */

export async function setup(): Promise<void> {}

export async function teardown(): Promise<void> {
  const report = readCurrentReport();

  console.log(`\nIntegration test route report — target=${report.target}, ranAt=${report.ranAt}`);
  console.log(`${"Route".padEnd(24)}${"Hit".padEnd(6)}Status`);
  for (const [route, entry] of Object.entries(report.routes)) {
    const status = entry.hit ? String(entry.statusCode) : "-";
    console.log(`${route.padEnd(24)}${(entry.hit ? "yes" : "no").padEnd(6)}${status}`);
  }
}
