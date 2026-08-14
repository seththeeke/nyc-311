import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Default 5s is fine locally but too tight for CodeBuild's SMALL
    // compute type synthesizing the full pipeline stack (many CodeBuild
    // projects, IAM roles, two nested app stages) — CI-only headroom.
    testTimeout: 20000,
    coverage: {
      provider: "v8",
      include: ["bin/**/*.ts", "stack/**/*.ts", "pipeline/**/*.ts", "data/**/*.ts", "lambda/**/*.ts"],
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
