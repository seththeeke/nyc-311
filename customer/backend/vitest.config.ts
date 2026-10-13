import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["controller/**/*.ts", "dao/**/*.ts", "models/**/*.ts", "service/**/*.ts", "logger.ts", "env.ts"],
      exclude: ["**/*.d.ts"],
      /* The same per-file gate every package shares (CLAUDE.md §5.4, testing-framework.md §2). */
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
        perFile: true,
      },
      reporter: [["text", { skipFull: true }], "html", "json-summary", "json"],
    },
  },
});
