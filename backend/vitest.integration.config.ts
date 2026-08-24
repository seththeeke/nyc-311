import { defineConfig } from "vitest/config";

/*
 * Real-integration tier (testing-framework.md §4, wired up per
 * 5-pipeline-integration-tests.md) — hits a live deployed AWS environment
 * (or `sam local start-api`) over the network, so it's deliberately its
 * own config with no coverage gate: coverage is already fully enforced by
 * the unit tier (vitest.config.ts). A formal endpoint-coverage % was
 * explicitly declined for just 3 routes in favor of the lightweight
 * route-hit report `support/routeTracker.ts` builds instead.
 */
export default defineConfig({
  test: {
    include: ["tests/integration/**/*.integration.test.ts"],
    testTimeout: 30000,
    /*
     * routeTracker.ts does a read-modify-write against one shared JSON
     * file across all 3 test files — serial execution avoids a write race
     * between them; there's no throughput reason to parallelize 3 files
     * hitting a live API anyway.
     */
    fileParallelism: false,
    globalSetup: ["./tests/integration/support/printReportSummary.ts"],
  },
});
