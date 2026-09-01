import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    /*
     * Real-integration tests (testing-framework.md §4) hit a live deployed
     * Nyc311-Test environment over the network — they run only via the
     * separate `npm run test:integration` (vitest.integration.config.ts),
     * never as part of this unit-tier run/coverage gate.
     */
    exclude: [...configDefaults.exclude, "tests/integration/**"],
    /*
     * These table/pipeline names back module-scope DAO/SDK-client
     * construction (Lambda cold-start pattern) in service/ingestion/
     * nyc311RequestService.ts, service/ingestion/requestEvaluationService.ts,
     * and service/pipeline/pipelineStatusService.ts — must exist before
     * those modules' static imports resolve, so set here rather than
     * per-test.
     */
    env: {
      REQUESTS_TABLE_NAME: "Requests",
      LOCATIONS_TABLE_NAME: "Locations",
      ORDERS_TABLE_NAME: "Orders",
      PIPELINE_NAME: "Nyc311Pipeline",
    },
    coverage: {
      provider: "v8",
      include: ["controller/**/*.ts", "dao/**/*.ts", "models/**/*.ts", "service/**/*.ts", "logger.ts"],
      exclude: ["**/*.d.ts"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
        perFile: true,
      },
      /*
       * skipFull drops files already at 100% from the text table only —
       * the recurring Operational-Loop run emitted ~65 zero-signal rows
       * here. Coverage math, the perFile 90% gate, and the html/json
       * reporters consumed by CI and scripts/rollup-coverage.js are
       * untouched; a file below 100% still shows, below 90% still fails.
       */
      reporter: [["text", { skipFull: true }], "html", "json-summary", "json"],
    },
  },
});
