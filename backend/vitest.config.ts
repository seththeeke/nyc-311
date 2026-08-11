import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["dao/**/*.ts", "models/**/*.ts", "logger.ts"],
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
