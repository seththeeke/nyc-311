import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
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
