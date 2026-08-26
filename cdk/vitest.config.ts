import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    /*
     * Default 5s is fine locally but too tight for CodeBuild's SMALL
     * compute type synthesizing the full pipeline stack (many CodeBuild
     * projects, IAM roles, two nested app stages) — CI-only headroom.
     */
    testTimeout: 20000,
    /*
     * 2026-08-26: two prior attempts each cut but didn't eliminate a
     * "Timeout calling onTaskUpdate" failure -- Vitest's worker RPC
     * channel, not the per-test timeout above. MEDIUM compute (was
     * SMALL) helped; threads -> forks (isolated OS processes, not a
     * shared Node process) cut it from 2 unhandled errors to 1. CodeBuild
     * still runs ~3x slower than local per file, leaving 2-way
     * parallelism racy there. Fully serial removes the race outright.
     */
    pool: "forks",
    poolOptions: {
      forks: {
        maxForks: 1,
        minForks: 1,
      },
    },
    coverage: {
      provider: "v8",
      include: [
        "bin/**/*.ts",
        "stack/**/*.ts",
        "pipeline/**/*.ts",
        "data/**/*.ts",
        "lambda/**/*.ts",
        "web/**/*.ts",
        "api/**/*.ts",
      ],
      exclude: [
        "**/*.d.ts",
        "**/*.types.ts",
        "**/constants.ts",
        "**/index.ts",
        "bin/*.ts", /* CDK app entrypoint — just instantiates stacks, per testing-framework.md §2 */
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
