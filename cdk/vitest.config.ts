import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["bin/**/*.ts", "stack/**/*.ts"],
      exclude: [
        "**/*.d.ts",
        "**/*.types.ts",
        "**/constants.ts",
        "**/index.ts",
        "bin/*.ts", // CDK app entrypoint — just instantiates stacks, per testing-framework.md §2
      ],
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
