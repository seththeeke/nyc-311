import { defineConfig } from "vitest/config";

/*
 * Real-integration tier (testing-framework.md §4, wired up per
 * 4-pipeline-integration-tests.md) — hits a live deployed AWS environment
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
     * Files run in parallel (Vitest default). routeTracker.ts writes one
     * partial file per route, and each known route is exercised by exactly
     * one test file, so parallel workers never contend on a shared file;
     * printReportSummary's teardown folds the partials into the final
     * route-report.json. Every file is a live-API round trip, so parallel
     * is close to a linear wall-clock win over the old serial run.
     */
    globalSetup: ["./tests/integration/support/printReportSummary.ts"],
  },
});
