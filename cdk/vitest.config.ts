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
     * 2026-08-26: raising CodeBuild's compute (SMALL -> MEDIUM) cut CI
     * duration 380s -> 188s but didn't fix a "Timeout calling
     * onTaskUpdate" failure -- Vitest's worker RPC channel, not the
     * per-test timeout above. Every file here does a real cdk synth
     * (esbuild-bundling several Lambdas); running many fully in parallel
     * starves the main thread servicing that channel, even though every
     * test itself passes. Capping threads trades wall-clock time for
     * not oversubscribing the CPU the orchestrator needs.
     */
    poolOptions: {
      threads: {
        maxThreads: 2,
        minThreads: 1,
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
