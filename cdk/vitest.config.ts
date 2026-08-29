import { cpus } from "node:os";
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
     * 30s (default 10s) of headroom for Nyc311Stack.test.ts's beforeAll,
     * which synthesizes the full stack twice (TEST + PROD) — ~4s of CPU
     * each and slower still when several forks synth concurrently below.
     */
    hookTimeout: 30000,
    /*
     * The "onTaskUpdate" Vitest worker-RPC timeout this pool config once
     * worked around has only ever reproduced on CodeBuild — and CI does
     * not use this parallelism anyway (the Synth step runs
     * `test:coverage:ci`, which shards the suite and pins each shard to
     * one fork). So local dev runs these ~30 synth-heavy files bounded-
     * parallel, halving `npm run test:coverage`; `forks` over `threads`
     * for synth isolation.
     */
    pool: "forks",
    poolOptions: {
      forks: {
        maxForks: Math.max(2, Math.ceil(cpus().length / 2)),
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
