import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Real-integration tests (testing-framework.md §4) hit a live deployed
    // Nyc311-Test environment over the network — they run only via the
    // separate `npm run test:integration` (vitest.integration.config.ts),
    // never as part of this unit-tier run/coverage gate.
    exclude: [...configDefaults.exclude, "tests/integration/**"],
    // REQUESTS_TABLE_NAME: controller/ingestion/nyc311PollerController.ts
    // constructs its RequestDao at module scope (Lambda cold-start
    // pattern), so this must exist before that module's static imports
    // resolve — set here rather than per-test so it's in place before any
    // test file's own imports run.
    env: { REQUESTS_TABLE_NAME: "Requests" },
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
      reporter: ["text", "html", "json-summary", "json"],
    },
  },
});
